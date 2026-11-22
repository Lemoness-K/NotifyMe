---
layout: review
title: "U5 운영·백업·복구 구현 계획"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/code-generation/code-generation-plan.md"
permalink: "/reviews/261115-notify-me-implementation/code-generation-u5-backup-retention/20261122-235946275985/01-code-generation-plan/"
---

# U5 운영·백업·복구 구현 계획

## Summary

- Builds: 로컬 주간 요약·장애 기록, 일관된 암호화 백업, 삭제 원장을 재적용하는 격리 복원과 안전한 서비스 재개
- Touches: U3 삭제 원장·유지보수의 두 경합, 로컬 운영 명령과 Node·SQLite 운영 모듈, systemd·Caddy 예제와 CI
- Tests: 합성 SQLite 실제 백업·복원, 잘린 원장·증거 누락·재시작·공개 차단, 전체 U1~U5 회귀와 라인 커버리지 80%

## Sources

U5 기능·NFR·인프라 설계, D-098과 Q-070 A안, `recovery-delete-journal-v1`을 따른다. U3 리뷰의 R-05(REQUESTED 뒤 소속 회수)와 R-06(설치 정리 실패가 원장 조정을 건너뜀)을 해결한다. U5 인프라 리뷰의 저장 매체 검증과 실제 API 부팅 차단을 구현·검증에 포함한다.

## Implementation Steps

- [x] Step 1 — 경계 확인. 실제 U3 원장 세대·작업 키·커밋 증거와 U4 서버 epoch 구성, 운영·테스트 모드를 비교한다. **US2.7, US8.4, US8.5.**
- [x] Step 2 — 테스트 실행 준비. 기존 Vitest 수집 목록에 U5 단위·통합 테스트를 연결하고 합성 DB·독립 증거 저장 위치·가짜 시계·별도 키로 실행되는지 확인한다. 기존 CI가 `deploy/u5` 단독 변경에도 관련 검증을 실행하도록 경로를 연결한다. **US8.2~US8.5.**
- [x] Step 3 — 저장 모델 Red. 기존 DB·원장 순방향 호환, 최신 증거의 계보·위치·인증값, 인증된 보존 바닥과 카탈로그, 활성화 전환의 중단 경계를 재현한다. **US2.7, US8.3, US8.4.**
- [x] Step 4 — 저장 모델 Green. 기존 업무 데이터는 보전하고 필요한 보호 로컬 상태와 버전을 추가한다. 운영자 초기화만 확인된 현재 원장에 권위 저장소를 연결한다. 권위 경로가 누락됐거나 잘못된 볼륨·계보라면 복구에서 자동 생성하지 않는다. 공개 서비스 재개에 사용하는 경로·epoch·판정을 한 레코드로 기록한다. **US8.3~US8.5.**
- [x] Step 5 — 저장 모델 Refactor. 인증 증거·운영 파일 검증을 공유하고 쓰기 성공·내구 게시·재시작 후 판정을 구분한다. **US8.3~US8.5.**
- [x] Step 6 — 원장 Red. REQUESTED 이후 소속 회수에서 새 요청과 과거 재시도를 구분하고, 독립 증거 쓰기 오류와 설치 정리 실패 뒤 원장 조정·백업이 어떻게 되는지 재현한다. **US2.7, US8.3, US8.4.**
- [x] Step 7 — 원장 Green. 새 삭제의 DB 변경 전 권위 있는 REQUESTED를 기록한다. 최초로 DB 변경 전 거절된 사실이 확인된 요청만 ABORTED로 종결한다. 과거 요청은 커밋 증거 확인 없이 종결하지 않는다. 권위 저장 실패는 성공을 응답하지 않으며 설치 정리와 원장 조정은 실패 경계를 분리한다. **US2.7, US8.4.**
- [x] Step 8 — 원장 Refactor. 요청 키·가구·리마인더·삭제 증거 확인과 작업의 배타 경계를 한곳에서 적용한다. 원본 호스트 유실에서 오래된 같은 계보를 거절한다. **US2.7, US8.4.**
- [x] Step 9 — 백업·복원 규칙 Red. WAL 변경 중 일관 사본, 태그·키 오류, 30일 정리와 게시의 경합, 잘린 원장·미확정·오류, 복구 후보 전환 실패와 재시작, 이전 서버 epoch의 FULL 전환을 시험한다. **US2.7, US8.3~US8.5.**
- [x] Step 10 — 백업·복원 규칙 Green. SQLite 온라인 사본을 만들고 AES-256-GCM으로 스트리밍 암호화한다. 보호 카탈로그 게시 직전 같은 락 안에서 인증 바닥과 cutoff를 재검증한다. 격리 복호화·원장 재적용·무결성·마이그레이션·기본 조회가 통과해야 활성화 레코드를 공개 가능 상태로 바꾼다. **US8.3, US8.4.**
- [x] Step 11 — 백업·복원 규칙 Refactor. 실패·재실행·임시 사본 정리를 재검증하고 만료한 모든 관리 중 사본 제거와 최신 기준점 보존을 확인한다. **US8.3, US8.4.**
- [x] Step 12 — 운영 경계 Red. 권위 매체 미마운트, 닫힌 복원에서 직접 API 및 Caddy 공개 API 요청, Worker 미기동, 로컬 운영 명령·보고 옵션·장애 중복·회복을 각각 시험한다. **US8.1, US8.2, US8.5.**
- [x] Step 13 — 운영 경계 Green. 권한 제한 로컬 소켓과 운영 명령을 추가한다. 서비스와 Worker는 내구 차단과 DB·epoch 불일치에서 공개 포트를 열지 않는다. 주간 요약과 장애 기록을 각각 기본 꺼짐으로 제공하고 호스트에서 조회한다. **US8.1, US8.2, US8.5.**
- [x] Step 14 — 운영 경계 Refactor. systemd의 최소 쓰기 경로·권위 매체 검사·일일 타이머와 Caddy의 공개 경계를 확인한다. 사용자 데이터·키 없이 로컬 상태·결과·자원 통계를 확인한다. **US8.1~US8.3, US8.5.**
- [x] Step 15 — 통합 리허설과 CI. 백업 뒤 합성 리마인더를 영구 삭제하고 오래된 암호화 사본을 격리 복원한다. 권위 최신 증거 유실·같은 계보의 짧은 원장·재적용 실패 각각에서 공개 차단을 확인한다. 전체 앱 회귀·ARM64·CI와 보류한 실기기 증거를 따로 기록한다. **US2.7, US8.1~US8.5.**

- [x] Step 16 — 현재 운영·복구 구현과 문서 변경 이력 재검증. U5 구현 커밋 `2035730`과 소스 매니페스트를 대조하고 `docs/06-deployment-and-operations.md`와 `docs/decision-register.md`의 D-098(운영 호스트의 주간 요약 및 장애 기록)을 독립 리뷰에 포함한다. U3·U4의 공유 결정 등록부 변경분은 Git 이력으로 구분한다. U5 전용 시험, U3 삭제 회귀와 승인된 전체 검증을 실행하고 새 증거를 남긴다.
- [x] Step 17 — 전체 Code Generation의 소스 검사 범위를 보완한다. [문서 변경 이력](../../code-generation/document-provenance.md)에서 Requirements Analysis의 `7022058`로 귀속되고 Delivery Planning 승인 이후 내용이 동일한 비실행 문서 5개만 `.aidlc-source-paths.json`의 `exclude`에 등록한다. 대상은 `AGENT.md`, `docs/02-domain-and-data-design.md`, `docs/03-system-architecture.md`, `docs/05-settings-and-feature-configuration.md`, `docs/09-feature-design-coverage-and-backlog.md`다. 구현 중 변경된 문서 5개와 제품 소스·테스트·배포 파일은 계속 검토 범위에 포함한다. 기존 설계 문서와 요구사항 추적은 유지하고, 전체 완료 검사 결과를 기록한다.

- [ ] Step 18 — 보존 기한 회귀 시험. 합성 시계와 임시 백업 저장소에서 30일 경계를 확인한다. 권위 원장 저장소를 사용할 수 없거나 앱의 운영 소켓이 없어도 인증된 만료 사본을 정리할 수 있는지 검증한다. 인증이 실패하면 파일을 보존하고 보존 정리 오류를 기록한다. 새 백업의 임시 파일과 유효한 사본도 정리 작업에서 보존되는지 확인한다.
- [ ] Step 19 — 백업 정리 경로 분리. 인증된 카탈로그를 바탕으로 만료 사본만 지우는 로컬 유지보수 명령을 만들고, 새 백업 생성과 원장 정리의 성공에 의존하지 않도록 실행 경로를 분리한다. 앱 서비스·권위 원장 없이 실행할 수 있도록 systemd 예제를 맞추고, 새 백업과 동시 실행될 때 카탈로그를 보호할 공용 배타 경계를 사용한다. 카탈로그 인증 실패·저장소 접근 실패를 운영자가 확인할 수 있게 기록한다. 수정은 D-058(암호화 백업 최대 30일 보관)에 필요한 범위로 한정한다.
- [ ] Step 20 — 보존 정리 검증 및 재리뷰. 새 회귀 테스트, U5 운영·복구 테스트, 승인된 전체 앱 검증을 실행한다. 로컬 systemd 정적 검증과 실제 Pi에서만 확인할 항목을 구분하고, U5 R-05의 수정 근거를 새 독립 리뷰에 포함한다.

## Verification boundaries

운영 DB·키·실제 Raspberry Pi의 공개 설정을 사용하지 않는다. 외부 전달 및 독립 호스트 장애 감지는 후속이다. 실제 Pi 응답·메모리·쓰기 budget은 DS-014에서 검증한다. 자동화 리허설은 합성 DB와 실제 SQLite 사본을 사용하며 배포·운영 데이터 전환을 실행하지 않는다.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "변경할 동작과 주요 위험을 검증하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패를 확인한 다음 구현하여 통과시키며 관련 회귀 테스트와 CI를 실행한다.",
  "scope": "classic",
  "test_strategy": "comprehensive",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Methodology evidence**: 인터뷰에서 TDD를 확정했다. 동작 변경에 대응하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패하는지 확인한다.\n- **Ordering**: 변경할 동작과 주요 위험을 검증하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패를 확인한 다음 구현하여 통과시키며 관련 회귀 테스트와 CI를 실행한다.\n- 변경 동작과 주요 위험에 초점을 둔 테스트를 작성하고 CI를 통과시킨다.\n- 전체 line coverage 80 percent 기준도 적용한다는 사용자의 답변이 확정됐다. 다만 `docs/08-test-strategy.md`는 고정된 전체 coverage 비율을 두지 않는다고 명시하므로 두 기준의 불일치를 구현 전에 조정해야 한다. 이 단계에서는 설계 문서를 수정하지 않았고 기준 간 정합성을 해결된 것으로 간주하지 않는다.\n- 테스트에는 synthetic data와 로컬 테스트 리소스를 사용하며 운영 데이터나 운영 자격 증명을 사용하지 않는다."
    },
    {
      "layer": "project",
      "text": "- Follow `docs/08-test-strategy.md` and the verification rules in `AGENT.md`. Use synthetic data and local test resources; never connect tests to production data or credentials."
    }
  ],
  "obligations": {
    "strategy": "comprehensive",
    "strategy_volume": [
      "Ten to fifteen tests per component.",
      "Unit, integration, and E2E tests.",
      "Add performance and security tests when NFRs demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:797c124264b70e97930ac31b1a0fae7671228a6511bab2d7ed73d513f05a4c8a",
  "contract_sha256": "sha256:db2da083c5032971c34e88a0118abbc7e7e1e1d718fd17056cb266c3a392dadb"
}
```
