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
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SITE_SOURCE = ROOT / "docs" / "review-site"
WORKFLOW_SOURCE = ROOT / ".github" / "workflows" / "deploy-review-site.yml"
PUBLISH_BRANCH = "ai-dlc-review-site"
DEFAULT_BRANCH = "master"
GITHUB_REPOSITORY = "Lemoness-K/NotifyMe"
PAGES_BASE_URL = "https://lemoness-k.github.io/NotifyMe"
DEPLOY_WORKFLOW = "deploy-review-site.yml"
FORBIDDEN_PARTS = {"audit", "memory", ".aidlc-engine", ".git"}
FORBIDDEN_NAMES = {"aidlc-state.md", "memory.md"}
ISSUE_MARKER_RE = re.compile(
    r"<!-- aidlc-review:intent=([a-z0-9-]+);stage=([a-z0-9-]+);review=([a-z0-9-]+) -->"
)


def git(args: list[str], cwd: Path = ROOT, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(cwd), *args],
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def gh(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["gh", *args],
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


def wait_for_pages_deployment(commit_sha: str) -> str:
    """Wait until the Pages build for this publication succeeds."""
    deadline = time.monotonic() + 180
    run: dict[str, object] | None = None

    print("AI-DLC 리뷰 사이트 배포를 기다리는 중입니다...")
    while time.monotonic() < deadline:
        result = gh(
            [
                "run",
                "list",
                "--repo",
                GITHUB_REPOSITORY,
                "--workflow",
                DEPLOY_WORKFLOW,
                "--branch",
                PUBLISH_BRANCH,
                "--commit",
                commit_sha,
                "--json",
                "databaseId,status,conclusion,url",
                "--limit",
                "1",
            ],
            check=False,
        )
        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode,
                ["gh", "run", "list"],
                output=result.stdout,
                stderr=result.stderr,
            )

        runs = json.loads(result.stdout)
        if runs:
            run = runs[0]
            break
        time.sleep(3)

    if run is None:
        raise TimeoutError("180초 안에 Pages 배포 실행을 찾지 못했습니다.")

    run_id = str(run["databaseId"])
    status = str(run["status"])
    if status != "completed":
        watched = gh(
            [
                "run",
                "watch",
                run_id,
                "--repo",
                GITHUB_REPOSITORY,
                "--compact",
                "--exit-status",
            ],
            check=False,
        )
        if watched.returncode != 0:
            raise subprocess.CalledProcessError(
                watched.returncode,
                ["gh", "run", "watch", run_id],
                output=watched.stdout,
                stderr=watched.stderr,
            )
    elif run.get("conclusion") != "success":
        raise RuntimeError(
            f"Pages 배포가 성공하지 않았습니다: {run.get('url', 'workflow run')} "
            f"({run.get('conclusion')})."
        )

    print("AI-DLC 리뷰 사이트 배포가 완료되었습니다.")
    return str(run.get("url", ""))


def find_open_review_issue(intent: str, stage: str) -> dict[str, Any] | None:
    result = gh(
        [
            "issue",
            "list",
            "--repo",
            GITHUB_REPOSITORY,
            "--state",
            "open",
            "--limit",
            "1000",
            "--json",
            "number,title,body,url",
        ]
    )
    issues = json.loads(result.stdout)
    matches: list[dict[str, Any]] = []
    for issue in issues:
        marker = ISSUE_MARKER_RE.search(str(issue.get("body") or ""))
        if marker and marker.group(1) == intent and marker.group(2) == stage:
            matches.append(issue)

    if len(matches) > 1:
        numbers = ", ".join(str(issue["number"]) for issue in matches)
        raise ValueError(
            f"{intent}/{stage}에 열린 AI-DLC 리뷰 이슈가 여러 개 있습니다: {numbers}."
        )
    return matches[0] if matches else None


def review_issue_body(entry: dict[str, Any], review_id: str) -> str:
    intent = str(entry["intent"])
    stage = str(entry["stage"])
    marker = (
        f"<!-- aidlc-review:intent={intent};stage={stage};review={review_id} -->"
    )
    lines = [
        marker,
        "",
        f"**Intent:** `{intent}`  ",
        f"**단계:** {entry['stage_title']} (`{stage}`)",
    ]
    next_stage = str(entry.get("next_stage") or "")
    if next_stage:
        lines.append(f"**승인 후 다음 단계:** {next_stage}")

    lines.extend(
        [
            "",
            str(entry.get("summary") or "검토가 필요한 AI-DLC 단계 산출물입니다."),
            "",
            "## 검토 문서",
            f"[Pages 문서 목록]({PAGES_BASE_URL}/)",
        ]
    )
    for review_file in entry["files"]:
        title = str(review_file["title"])
        summary = str(review_file["summary"])
        url = PAGES_BASE_URL.rstrip("/") + str(review_file["url"])
        lines.append(f"- [{title}]({url}) — {summary}")

    lines.extend(
        [
            "",
            "## 승인 또는 수정 요청",
            "",
            "GitHub에서 승인하려면 저장소 소유자 계정으로 댓글 본문에 `승인` 또는 `/approve`만 남겨 주세요. "
            "승인 댓글은 자동으로 이 이슈를 닫습니다.",
            "수정 요청도 저장소 소유자 계정으로 `수정 요청: <내용>` 형식으로 남겨 주세요. 수정 요청이 있으면 이 이슈는 열린 상태로 유지됩니다.",
            "기존 Codex 승인 게이트에서 승인해도 됩니다. Codex에서 승인하면 승인 기록을 남기고 이 이슈를 닫습니다.",
            "",
            "이 Issue와 코멘트는 공개 저장소에서 공개됩니다. Pages는 문서 열람용이며 이슈의 코멘트가 리뷰 기록입니다.",
        ]
    )
    return "\n".join(lines) + "\n"


def publish_review_issue(entry: dict[str, Any], pack_id: str) -> str:
    intent = str(entry["intent"])
    stage = str(entry["stage"])
    existing = find_open_review_issue(intent, stage)
    review_id = pack_id
    if existing:
        marker = ISSUE_MARKER_RE.search(str(existing.get("body") or ""))
        if marker:
            review_id = marker.group(3)

    title = f"[AI-DLC 리뷰] {entry['stage_title']} · {intent}"
    body = review_issue_body(entry, review_id)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".md", delete=False
    ) as body_file:
        body_file.write(body)
        body_path = Path(body_file.name)

    try:
        if existing:
            gh(
                [
                    "issue",
                    "edit",
                    str(existing["number"]),
                    "--repo",
                    GITHUB_REPOSITORY,
                    "--title",
                    title,
                    "--body-file",
                    str(body_path),
                ]
            )
            print(f"기존 AI-DLC 리뷰 이슈 #{existing['number']}을(를) 갱신했습니다.")
            return str(existing["url"])

        result = gh(
            [
                "issue",
                "create",
                "--repo",
                GITHUB_REPOSITORY,
                "--title",
                title,
                "--body-file",
                str(body_path),
            ]
        )
        output_lines = [
            line.strip() for line in result.stdout.splitlines() if line.strip()
        ]
        if not output_lines:
            raise RuntimeError("GitHub CLI가 리뷰 이슈 URL을 반환하지 않았습니다.")
        issue_url = output_lines[-1]
        print("AI-DLC 리뷰 이슈를 만들었습니다.")
        return issue_url
    finally:
        body_path.unlink(missing_ok=True)


def publish(args: argparse.Namespace) -> tuple[str, str, dict[str, Any]]:
    intent = require_slug(args.intent, "intent")
    stage = require_slug(args.stage, "stage")
    files = read_review_files(args.files)
    now = datetime.now(timezone.utc)
    pack_id = now.strftime("%Y%m%d-%H%M%S%f")
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
            commit_sha = git(["rev-parse", "HEAD"], cwd=worktree).stdout.strip()
            git(
                ["push", "origin", f"HEAD:refs/heads/{PUBLISH_BRANCH}"],
                cwd=worktree,
            )
        finally:
            git(["worktree", "remove", "--force", str(worktree)], check=False)

    deployment_url = wait_for_pages_deployment(commit_sha)
    print(f"Pages 사이트 배포가 완료되었습니다: {PAGES_BASE_URL}/")
    issue_url = publish_review_issue(entry, pack_id)
    return deployment_url, issue_url, entry


def main() -> int:
    parser = argparse.ArgumentParser(
        description="선택한 AI-DLC 단계 산출물을 Pages에 게시하고 리뷰 Issue를 만듭니다."
    )
    parser.add_argument("--intent", required=True, help="AI-DLC intent 식별자")
    parser.add_argument("--stage", required=True, help="AI-DLC stage 식별자")
    parser.add_argument("--stage-title", required=True, help="단계 표시 이름")
    parser.add_argument("--next-stage", default="", help="엔진이 보고한 다음 단계 이름")
    parser.add_argument("--summary", default="검토가 필요한 AI-DLC 단계 산출물입니다.")
    parser.add_argument(
        "--file",
        dest="files",
        action="append",
        required=True,
        help="게시할 Markdown 파일. 파일마다 반복 지정합니다.",
    )
    args = parser.parse_args()

    try:
        deployment_url, issue_url, entry = publish(args)
    except (
        OSError,
        ValueError,
        TimeoutError,
        RuntimeError,
        subprocess.CalledProcessError,
    ) as error:
        print(f"리뷰 게시에 실패했습니다: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError):
            details = error.stderr or error.output
            if details:
                print(details.strip(), file=sys.stderr)
        return 1

    print("리뷰 문서를 ai-dlc-review-site 브랜치에 게시했습니다.")
    print(f"GitHub Issue: {issue_url}")
    if deployment_url:
        print(f"Pages 배포 실행: {deployment_url}")
    print(f"GitHub Pages: {PAGES_BASE_URL}/")
    print("검토 문서:")
    for review_file in entry["files"]:
        print(
            f"- {review_file['title']}: "
            f"{PAGES_BASE_URL.rstrip('/')}{review_file['url']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
