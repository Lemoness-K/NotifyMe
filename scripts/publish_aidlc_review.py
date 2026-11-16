#!/usr/bin/env python3
"""Publish selected AI-DLC stage artifacts to the isolated Pages branch."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_SOURCE = ROOT / "docs" / "review-site"
WORKFLOW_SOURCE = ROOT / ".github" / "workflows" / "deploy-review-site.yml"
PUBLISH_BRANCH = "ai-dlc-review-site"
DEFAULT_BRANCH = "master"
FORBIDDEN_PARTS = {"audit", "memory", ".aidlc-engine", ".git"}
FORBIDDEN_NAMES = {"aidlc-state.md", "memory.md"}


def git(args: list[str], cwd: Path = ROOT, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(cwd), *args],
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def require_slug(value: str, label: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", value):
        raise ValueError(f"{label} must use lowercase letters, digits, and hyphens: {value}")
    return value


def markdown_title_and_summary(content: str, fallback: str) -> tuple[str, str]:
    lines = content.splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), fallback)
    summary = ""
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("<!--"):
            continue
        summary = re.sub(r"[*_]", "", stripped)
        break
    if len(summary) > 180:
        summary = summary[:177].rstrip() + "..."
    return title, summary or "단계 산출물"


def strip_front_matter(content: str) -> str:
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return content
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return "\n".join(lines[index + 1 :]).lstrip()
    return content


def copy_site_source(target_root: Path) -> None:
    target_site = target_root / "docs" / "review-site"
    for source in SITE_SOURCE.rglob("*"):
        relative = source.relative_to(SITE_SOURCE)
        if relative.parts and relative.parts[0] == "reviews":
            continue
        if relative.as_posix() == "_data/reviews.json":
            continue
        target = target_site / relative
        if source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    target_workflow = target_root / ".github" / "workflows" / WORKFLOW_SOURCE.name
    target_workflow.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(WORKFLOW_SOURCE, target_workflow)


def read_review_files(paths: list[str]) -> list[tuple[Path, str, str, str]]:
    root = ROOT.resolve()
    files: list[tuple[Path, str, str, str]] = []
    seen: set[str] = set()

    for raw_path in paths:
        candidate = ROOT / raw_path
        if candidate.is_symlink():
            raise ValueError(f"Symlink source is not allowed: {raw_path}")
        source = candidate.resolve()
        if not source.is_relative_to(root):
            raise ValueError(f"Review files must stay inside the repository: {raw_path}")
        relative = source.relative_to(root)
        if any(part in FORBIDDEN_PARTS for part in relative.parts):
            raise ValueError(f"Internal runtime files cannot be published: {raw_path}")
        if source.name in FORBIDDEN_NAMES or source.suffix.lower() != ".md":
            raise ValueError(f"Only reviewable Markdown artifacts are accepted: {raw_path}")
        if not source.is_file():
            raise ValueError(f"Review file does not exist: {raw_path}")
        if raw_path in seen:
            raise ValueError(f"Duplicate review file: {raw_path}")
        seen.add(raw_path)

        content = source.read_text(encoding="utf-8")
        title, summary = markdown_title_and_summary(content, source.stem.replace("-", " ").title())
        files.append((source, relative.as_posix(), title, summary))

    if not files:
        raise ValueError("Pass at least one --file.")
    return files


def publish(args: argparse.Namespace) -> str:
    intent = require_slug(args.intent, "intent")
    stage = require_slug(args.stage, "stage")
    files = read_review_files(args.files)
    now = datetime.now(timezone.utc)
    pack_id = now.strftime("%Y%m%d-%H%M%S")
    pack_dir = Path("reviews") / intent / stage / pack_id
    entry = {
        "id": f"{intent}/{stage}/{pack_id}",
        "intent": intent,
        "stage": stage,
        "stage_title": args.stage_title,
        "created_at": now.isoformat(),
        "next_stage": args.next_stage or "",
        "summary": args.summary,
        "files": [],
    }

    fetch = git(["fetch", "origin", PUBLISH_BRANCH], check=False)
    if fetch.returncode == 0:
        base_ref = f"origin/{PUBLISH_BRANCH}"
    else:
        git(["fetch", "origin", DEFAULT_BRANCH])
        base_ref = f"origin/{DEFAULT_BRANCH}"

    with tempfile.TemporaryDirectory(prefix="aidlc-review-site-") as temporary:
        worktree = Path(temporary) / "worktree"
        git(["worktree", "add", "--detach", str(worktree), base_ref])
        try:
            copy_site_source(worktree)
            target_pack = worktree / "docs" / "review-site" / pack_dir
            target_pack.mkdir(parents=True, exist_ok=True)

            for index, (source, source_path, title, summary) in enumerate(files, start=1):
                stem = re.sub(r"[^a-z0-9-]+", "-", source.stem.lower()).strip("-") or f"document-{index}"
                page_path = pack_dir / f"{index:02d}-{stem}.md"
                permalink = "/" + page_path.with_suffix("").as_posix() + "/"
                destination = worktree / "docs" / "review-site" / page_path
                destination.parent.mkdir(parents=True, exist_ok=True)
                content = strip_front_matter(source.read_text(encoding="utf-8"))
                front_matter = (
                    "---\n"
                    "layout: review\n"
                    f"title: {json.dumps(title, ensure_ascii=False)}\n"
                    f"source_path: {json.dumps(source_path, ensure_ascii=False)}\n"
                    f"permalink: {json.dumps(permalink, ensure_ascii=False)}\n"
                    "---\n\n"
                )
                destination.write_text(front_matter + content.rstrip() + "\n", encoding="utf-8")
                entry["files"].append(
                    {
                        "title": title,
                        "summary": summary,
                        "url": permalink,
                        "source_path": source_path,
                    }
                )

            data_path = worktree / "docs" / "review-site" / "_data" / "reviews.json"
            data_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                history = json.loads(data_path.read_text(encoding="utf-8"))
            except FileNotFoundError:
                history = []
            if not isinstance(history, list):
                raise ValueError("Review site data must be a JSON array.")
            history.append(entry)
            data_path.write_text(
                json.dumps(history, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            git(["add", "docs/review-site", ".github/workflows/deploy-review-site.yml"], cwd=worktree)
            git(["commit", "-m", f"docs: publish AI-DLC review pack for {stage}"], cwd=worktree)
            git(
                ["push", "origin", f"HEAD:refs/heads/{PUBLISH_BRANCH}"],
                cwd=worktree,
            )
        finally:
            git(["worktree", "remove", "--force", str(worktree)], check=False)

    return "https://lemoness-k.github.io/NotifyMe/"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--intent", required=True, help="AI-DLC intent slug")
    parser.add_argument("--stage", required=True, help="AI-DLC stage slug")
    parser.add_argument("--stage-title", required=True, help="Human-readable stage name")
    parser.add_argument("--next-stage", default="", help="Engine-reported next stage")
    parser.add_argument("--summary", default="검토가 필요한 AI-DLC 단계 산출물입니다.")
    parser.add_argument("--file", dest="files", action="append", required=True, help="Markdown file to publish; repeat for each file")
    args = parser.parse_args()

    try:
        page_url = publish(args)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Review publication failed: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        return 1

    print("Review bundle published to branch ai-dlc-review-site.")
    print(f"GitHub Pages: {page_url}")
    print("Wait for the Deploy AI-DLC review site workflow to succeed before sharing the page.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
