---
layout: review
title: "실천 발견 근거"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/practices-discovery/evidence.md"
permalink: "/reviews/261115-notify-me-implementation/practices-discovery/20261116-221116498068/03-evidence/"
---

# 실천 발견 근거

## 조사한 자료와 저장소 관찰

- Reverse Engineering 산출물 `code-structure.md`, `technology-stack.md`, `dependencies.md`, `code-quality-assessment.md`, `architecture.md`, `business-overview.md`를 검토했다. 저장소에는 실행 가능한 제품 코드·패키지, manifest·lockfile, 제품 테스트·빌드·lint·CI가 확인되지 않았다. 기술 스택과 Raspberry Pi 중심 구조는 계획으로 기록돼 있으며, 구현 관행의 증거가 아니다.
- `AGENT.md`, `docs/decision-register.md`, `docs/00-master-design.md`, `docs/03-system-architecture.md`, `docs/06-deployment-and-operations.md`, `docs/08-test-strategy.md`를 검토했다. 프로젝트 문서는 한국어 문서 작성과 ID 추적을 요구하고, 테스트는 synthetic data와 로컬 리소스를 사용하며 운영 데이터·자격 증명에 연결하지 않도록 한다.
- `docs/08-test-strategy.md`는 변경 동작 테스트를 먼저 작성하고 가능한 경우 구현 전 실패를 확인하는 순서를 설명한다. 또한 고정된 전체 coverage 비율을 두지 않는다고 명시한다.
- `.github/workflows/close-aidlc-review-issue.yml`과 `.github/workflows/deploy-review-site.yml`은 AI-DLC 리뷰 Issue와 리뷰 사이트를 위한 워크플로다. 제품 CI 또는 제품 배포 증거로 취급하지 않는다.
- 최근 git 기록은 프로젝트 문서와 AI-DLC 리뷰 기능·산출물에 관한 커밋이다. 제품 코드가 없어 제품 브랜치·PR·배포 관행은 이력으로 확인되지 않는다.
- `aidlc/spaces/default/memory/team.md`에는 기존 확정 실천이 없다. 프로젝트 메모리의 walking-skeleton 항목은 제품 목표 맥락이며 선행 통합 구현 관행을 의미하지 않는다.

## 이미 승인된 제품 결정 및 열린 질문

- `Q-063`(선택적 완료 검증)은 이번 범위에 포함하기로 승인됐으나 상세 정책은 미결정이다.
- `Q-064`(주간 운영 보고·즉시 장애 알림)은 이번 범위에 포함하기로 승인됐으나 상세 정책은 미결정이다.
- 위 질문의 세부사항은 이 실천 인터뷰에서 해결하지 않았으며 열린 상태로 유지한다.

## 인터뷰에서 확정된 실천

- Way of Working: 사용자는 설계 문서를 GitHub Issue에서 검토하고 Issue 또는 Codex에서 승인하며, 어느 쪽에서 승인해도 Issue를 정리·닫는다고 답했다. PR 병합은 rebase-and-merge다.
- Walking Skeleton: 예. 기능 구현에 앞서 서비스 전체 흐름을 관통하는 최소 동작 슬라이스를 만든다.
- Testing Posture: TDD를 확정했다. 테스트를 먼저 작성하고 가능한 경우 구현 전에 실패하는지 확인한다.
- Coverage/CI: 사용자는 위험 중심 테스트와 CI, 전체 line coverage 80 percent 기준을 모두 원한다고 확인했다.
- Deployment: 제품 배포 정책은 앱 코드가 생길 때까지 미룬다.
- Code Style: 처음에는 언어 관례를 따르고 실제 코드 패턴이 생긴 뒤 formatter와 linter를 추가한다.
- 통합 요약에 대해 사용자는 “Looks correct”라고 확인했다.

## 추론과 구현 전 해소할 사항

- 테스트 기준 충돌: `docs/08-test-strategy.md`는 고정된 전체 coverage 기준이 없다고 정하지만, 인터뷰에서 사용자는 위험 중심 검증과 함께 80 percent 전체 line coverage 및 CI를 확정했다. 두 기준을 모두 기록했으며, 이 단계에서 문서를 수정하거나 기준이 이미 정합하다고 단정하지 않았다. 구현 전에 적용 기준과 문서 조정 필요성을 해결해야 한다.
- 제품 코드가 없으므로 formatter, linter, 실제 테스트 runner, 구체적인 naming 규칙 및 제품 배포 환경·승인·롤백 운영은 관찰할 수 없다. 코드가 생기거나 배포 정책을 결정하는 시점까지 해당 세부사항은 미정이다.
- GitHub Actions 워크플로의 이름에 deploy가 포함되더라도 대상은 리뷰 사이트다. 이를 제품의 배포 cadence나 환경 topology로 추론하지 않았다.
