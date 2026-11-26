# 모바일 최초 관리자 등록 구현 계획

## Summary

- Builds: 운영자 전용 Tailscale에서 모바일 첫 Google 로그인, 후보 확인·취소, 가구와 첫 관리자 등록, 리마인더 진입
- Touches: SQLite 마이그레이션, 서버 인증·설치 운영, 웹 로그인 화면, Pi 운영 가이드와 요구사항·추적 문서
- Tests: 변경 영역별 5~8개 표준 테스트, SQLite/API 회귀, 모바일 화면 Chromium 테스트와 별도 Android Chrome 실기기 검증

## 입력과 변경 영향

`functional-spec.md`, `rules.md`, `entities.md`에서 정한 후보·설치 모델을 사용한다. `unit-of-work.md`의 U1과 `requirements.md`의 FR11.1~FR11.6 및 NFR11~NFR14를 적용한다. 기능 설계 검토에서 제안한 일회성 로그인 증명 소비와 후보 갱신의 원자적 처리, 커밋 전·커밋 후 재기동을 각각 검증한다.

| 경계 | 예정 파일 | 영향 |
|---|---|---|
| 데이터 모델 | `prisma/schema.prisma`, 새 `prisma/migrations/*_mobile_admin_onboarding/migration.sql`, `src/server/storage.ts` 필요 시 테스트 마이그레이션 등록 | 기존 DB의 설치 자격 기본 닫힘. 기존 데이터와 일반 역할 유지. |
| 운영과 보존 경계 | `src/server/operations/activation.ts`, `runtime.ts`, `restore.ts`, 신규 설정 자격 모듈, `src/server/main.ts`, `src/server/config.ts`, `src/server/operations-cli.ts` | 관리형 활성 세대, 보호된 설정 기록, 복원 경로 및 명시적 새 설치 준비. |
| 인증·가구·API | `src/server/auth.ts`, `http.ts`, `bootstrap-admin.ts`, 신규 후보 로직, 관련 오류·가구 경계 필요 시 | 기존 로그인·초대를 유지하고, 브라우저의 후보 응답·제한된 권한과 원자적 확정을 추가. 기존 CLI로 운영 상태 우회 차단. |
| 브라우저 | `src/web/client.ts`, `App.tsx`, `messages.ts`, 필요 시 웹 스타일 | 웹 기본 로그인 경로에서 후보 화면 표시, 같은 계정 재인증 및 취소, 리마인더 route 전환. |
| 운영·제품 문서 | `docs/decision-register.md`, `docs/00-master-design.md`, `docs/01-product-requirements.md`, `docs/02-domain-and-data-design.md`, `docs/03-system-architecture.md`, `docs/06-deployment-and-operations.md`, `docs/07-security-and-privacy.md`, `docs/08-test-strategy.md`, `docs/09-feature-design-coverage-and-backlog.md`, `docs/u1-local-run.md`, 관련 새 ADR과 `deploy/u5/` 운영 예제 | 과거 CLI 및 신규 정책을 연결. 최초 설정 안내, 승인 범위·격리 검증·복원 및 롤백 절차. |

운영 Pi의 DB를 변경하지 않고, 검증 명령은 모두 합성 인증과 격리 SQLite를 사용한다. 파괴적 재설정 자체와 공개 네트워크 변경은 별도 승인 대상으로 둔다.

## 실행 단계

- [x] Step 1 — 기존 구성, 마이그레이션 대상 경계, 운영 예제, 로컬과 관리형 시작을 확인한다. 작업 전 변경 파일과 영향 범위를 확정한다. FR11.1, FR11.5, NFR12.
- [x] Step 2 — 기존 Vitest와 Chromium 설정 및 패키지 생성 경로를 확인한다. 단위 테스트 명령의 기존 테스트 경로와 전체 타입·빌드·커버리지·브라우저 기준 결과를 기록한다. 설정은 필요한 경우에만 보완하며 80% 전체 라인 기준을 유지한다. FR11.2, FR11.5, NFR11.
- [x] Step 3 — 데이터 모델 Red. `tests/u1/mobile-admin-onboarding.test.ts`에 신규 생성과 기존 DB의 닫힌 기본값, 설치 식별자·후보·완료 제약, 트랜잭션 롤백 테스트를 먼저 작성한다. FR11.1, FR11.3, NFR11, NFR12.
- [x] Step 4 — 데이터 모델 Green. 버전 관리된 마이그레이션과 Prisma 스키마로 설정 주기 식별, 후보, 완료 기록을 도입한다. 기존 SQLite 내용·역할을 보존한다. FR11.1, FR11.3, NFR11, NFR12.
- [x] Step 5 — 데이터 모델 Refactor. 마이그레이션 검증을 재실행하고 기존 운영·테스트 DB 경로에서 동작을 확인한다. FR11.5, NFR12.
- [x] Step 6 — 저장·운영 Red. `tests/u5/mobile-admin-onboarding-operations.test.ts`에서 의도적 신규 준비, 경로 변경/누락, 복원, 이전 주기, 종료, 커밋 전·후 중단의 재기동 테스트를 먼저 작성한다. FR11.1, FR11.6, NFR12.
- [x] Step 7 — 저장·운영 Green. 보호된 설정 허용 기록을 활성 DB·세대에 결합하고 기존 운영 소유권·복원 경계와 연결한다. SQLite 확정 전의 진행 기록과 확정 후 봉인, 증거가 불명확한 차단을 구현한다. FR11.1, FR11.6, NFR11, NFR12.
- [x] Step 8 — 저장·운영 Refactor. 관리형 복원에 새 등록 허용 경로가 생기지 않는지 확인하고 재기동·예외 흐름을 정리한다. FR11.5, NFR12.
- [x] Step 9 — 업무 규칙 Red. 두 계정 예약, 취소·만료·교체·중복 확정, 일회성 인증 증명 재사용, 완료 후 같은 계정 복귀, 활성 DB 전환 경쟁을 테스트한다. FR11.1, FR11.3, FR11.4, NFR11, NFR13.
- [x] Step 10 — 업무 규칙 Green. 기존 증명 검증을 재사용한다. 챌린지·로그인 증명을 후보 예약 또는 갱신과 한 트랜잭션에서 소비한다. 확인과 운영 전환을 직렬화하고 최초 가구·ADMIN·완료를 원자적으로 확정한다. FR11.1, FR11.3, FR11.4, NFR11, NFR12, NFR13.
- [x] Step 11 — 업무 규칙 Refactor. 후보와 일반 세션의 인가를 분리하고 역할·가구 결합을 유지한다. 동시성, 롤백, 응답 유실 테스트를 재실행한다. FR11.3, FR11.4, FR11.5, NFR11.
- [x] Step 12 — API Red. 후보 전용 상태 조회·확인·취소, 현재 계정·주기 불일치, 후보 업무 API 차단, 기존 로그인·초대, 실패 응답의 개인정보 비노출을 테스트한다. FR11.2~FR11.5, NFR13.
- [x] Step 13 — API Green. 기존 로그인 호환 응답을 보존하면서 후보 분기와 제한된 상태 변경을 제공한다. 쿠키와 현재 인증을 확인하고 등록 이후 일반 세션을 발급한다. FR11.2~FR11.5, NFR13.
- [x] Step 14 — API Refactor. 요청 경계, 오류 응답과 테스트를 점검한다. 운영에서 기존 최초 관리자 CLI가 보호를 우회할 수 없게 한다. FR11.5, NFR12, NFR13.
- [x] Step 15 — 웹 Red. `tests/u1/mobile-admin-onboarding-web.test.tsx`, `tests/e2e/u1/core-flow.spec.ts`에서 모바일 너비 계정·문구·버튼, 취소, 새로고침·계정 전환, 중복, 저장을 검증한다. FR11.2~FR11.5, NFR14.
- [x] Step 16 — 웹 Green. 공유 로그인에 설정 화면과 접근 가능한 처리 상태를 추가하고 성공 시 기존 리마인더 경로로 진입한다. 필요한 테스트 선택자를 추가한다. FR11.2~FR11.5.
- [x] Step 17 — 웹 Refactor. 기존 언어 자원, 좁은 화면·키보드, 갱신과 네트워크 오류를 확인하고 회귀 테스트를 실행한다. FR11.2, FR11.4, FR11.5.
- [x] Step 18 — 운영 구성을 검증한다. 기존 운영 예제에 설치 준비와 독립 테스트 세대 절차를 반영한다. 새 설치, 대상 불일치와 복원 시 등록 차단을 합성 환경에서 확인한다. FR11.6, NFR12, NFR14.
- [x] Step 19 — D-074 이력을 보존하고 새 결정과 Q-048, Q-071, DS-003, F-HH-001, PR-AC-058 및 관련 문서·추적표를 갱신한다. 공개 전 보호 정책 보류를 기록한다. Pi 첫 설정과 재설정, Wi-Fi를 끈 Android Chrome에서 Google 로그인→확인→저장·재조회 순서를 운영 가이드에 작성한다. FR11.6, NFR14.
- [x] Step 20 — 타입 검사, 단위/통합, Chromium, 기존 전체 회귀를 실행해 결과와 미수행 실기기 항목을 구분한다. FR11.1~FR11.6, NFR11~NFR14.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "변경할 동작과 주요 위험을 검증하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패를 확인한 다음 구현하여 통과시키며 관련 회귀 테스트와 CI를 실행한다.",
  "scope": "refactor",
  "test_strategy": "standard",
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
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
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
  "input_sha256": "sha256:3b0b1379529462e98eeb0e55b777708907a3f83529b84c04e77f9d2c7ce79a48",
  "contract_sha256": "sha256:c51eee1eeeb85a2e66e429eb9a4737738e275d1b1db0b527755d4d95b66408a9"
}
```
