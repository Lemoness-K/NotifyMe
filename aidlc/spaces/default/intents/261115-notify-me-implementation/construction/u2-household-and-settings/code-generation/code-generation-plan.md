# U2 코드 작성 계획

## Summary

- Builds: 가구 초대·역할·제거, 설정 카탈로그와 계정 언어·시간대, 관리 화면
- Touches: 기존 인증·공유 웹·서버·SQLite 마이그레이션, U2 테스트와 API 계약
- Tests: 구성요소별 10~15건의 단위·통합·종단 검증과 기존 U1 회귀 및 전체 라인 커버리지 80%

## Sources

U2의 `functional-spec.md`, `rules.md`, `entities.md`, `frontend-components.md`, 비기능·인프라 산출물과 [계약 설계](../../../inception/contract-design/contract-summary.md), [작업 단위](../../../inception/units-generation/unit-of-work.md)를 사용한다. U1의 완료 커밋 `9200199`와 `docs/08-test-strategy.md`를 기존 코드와 검증 기준으로 사용한다.

## Steps

- [x] Step 1. **기존 앱과 계약 확인.** `src/server/{auth,http,provider,repository}.ts`, `src/web/{App,client,messages}`, `prisma/schema.prisma`의 영향 범위와 U1 테스트 기본선을 기록한다. U2 구현에 필요한 HTTP 계약 차이는 아래 표대로 기록한다. (US1.4, US1.5, US1.7, US6.1~US6.8)
- [x] Step 2. **테스트 실행 준비.** `vitest.config.ts`와 `playwright.config.ts`를 확장해 `tests/u2/`와 `tests/e2e/u2/`를 포함하고 정해진 경로의 탐색 명령을 확인한다. 고정된 완료 검증 명령이 기존 U1과 U2를 모두 실행하게 유지한다.
- [x] Step 3. **데이터 모델 Red.** `tests/u2/storage-model.test.ts`에서 기존 U1 DB의 계정·초기 Admin·리마인더·배정 보존, 기존 데이터에 새 필드 적용, 초대 상태·해시·협력 제약, 만료 이메일 제거, 회원 삭제 롤백을 먼저 검증한다. (US1.4, US1.5, US1.7, US6.1, US6.5)
- [x] Step 4. **데이터 모델 Green.** 새 Prisma 마이그레이션으로 초대, 소속 revision·제거 상태, 필요한 역할·가구 감사 정보, 가구·계정 설정 및 기준 저장 위치를 추가한다. 기존 행을 유효한 기본값으로 읽고, 기존 U1 세션과 업무 데이터가 계속 동작하게 한다.
- [x] Step 5. **데이터 모델 Refactor.** 외래 키·인덱스·만료 데이터 범위를 확인하고 U1에서 시작하는 마이그레이션 및 롤백 회귀를 유지한다.
- [x] Step 6. **저장소 Red.** `tests/u2/repository.test.ts`에 중복 발급·소비·취소, 작업 키 변경 입력, 최신 revision 경합, 같은 가구 실제 Assignment 종료, 기록·설정 실패 시 부분 변경 방지 사례를 작성한다. (US1.4, US1.5, US1.7, US6.5, US6.6)
- [x] Step 7. **저장소 Green.** U2 가구·설정 저장소와 기존 U1 저장소에 필요한 공용 경계를 추가한다. 실제 U1 배정을 같은 트랜잭션에서 종료하고 다른 구성원·가구·업무·이력을 보존한다. U3/U4 참여 지점을 명시하고 해당 후속 데이터가 없는 경우만 연결 대역으로 검증한다.
- [x] Step 8. **저장소 Refactor.** 가구 범위 필터, 상태 조건, 요청 결과 저장과 합성 fixture를 정리한다. 작업 결과에 코드 원문·이메일·자격 증명이 남지 않는지 확인한다.
- [x] Step 9. **업무 규칙 Red.** `tests/u2/household-rules.test.ts`와 `tests/u2/settings-rules.test.ts`에서 이메일 식별, 잘못된 증거, 만료 경계, 역할 인계, 설치와 Reminder scope, locale 우선순위, 시간대, 반경·상한·주간 정책을 검증한다. (US1.4, US1.5, US6.1~US6.8)
- [x] Step 10. **업무 규칙 Green.** 초대 가입과 원자적 역할·배정 처리, 카탈로그 정의와 실제 값 분리, 계정 언어 및 표시 시간대, 가구 기본값과 장소·주간 정책을 구현한다. 미확정 사용자는 검증된 초대 수락 표면만 도달하게 하고 다른 로그인·업무 경계를 유지한다.
- [x] Step 11. **업무 규칙 Refactor.** 인증 공급자 검증과 로컬 합성 증거를 분리하고, 호환성과 단위별 확장 경계를 확인한다. `/me/settings`는 세션과 본인만 검사하며 가구 API에는 활성 소속을 요구한다.
- [x] Step 12. **API Red.** `tests/u2/http.test.ts`에서 초대 1회 노출과 409 복구, Admin 전용 상태 조회, 후임 Admin 전달, 계정과 가구 인가 구분, 제한 429·503 및 Retry-After, 실제 데이터 제거와 비밀 미노출을 검증한다. (US1.4, US1.5, US1.7, US6.1~US6.8)
- [x] Step 13. **API Green.** 계약의 가구·계정·설정·초대 경로를 공용 HTTPS·인가·오류 처리에 연결한다. 초대 발급 409에서 현재 인가된 발급자만 안전한 식별 정보를 받게 한다. 서버 요청 제한, 바운드된 만료 이메일 정리, 재시도 후 효과 중복 방지를 적용한다.
- [x] Step 14. **API Refactor.** 안정된 라우트·결과 코드와 권한 경계를 확인한다. 실제 Caddy 경유 테스트에서 전달 헤더 덮어쓰기, 외부 헬스 접근 차단 및 초대 응답의 비캐시를 확인한다.
- [x] Step 15. **웹 Red.** `tests/u2/web-interactions.test.tsx`와 `tests/e2e/u2/household-settings.spec.ts`에서 초대·신규 가입·관리 화면 재진입, 역할·권한 변경, 언어 설정의 클라이언트 간 공유, 오류 후 대기나 입력 보존을 검증한다. (US1.4, US1.5, US1.7, US6.1~US6.8)
- [x] Step 16. **웹 Green.** 관리 및 개인 설정·초대 화면을 기존 React Router에 붙인다. 코드 fragment는 수락에 필요한 동안만 보유하고 URL에서 제거한다. 관리 화면 재접근 시 안전한 상태 목록만 읽는다. 한국어·영어·표시 시간대와 반응형 조작을 적용한다.
- [x] Step 17. **웹 Refactor.** 번역 키와 오류 처리를 공유하고 관리·개인·설치 영역의 화면 동작을 대조한다. 새 U2 읽기와 쓰기에 재시도 안내를 적용하고, 공용 목록 재시도의 Retry-After도 회귀 테스트로 검증한다.
- [x] Step 18. **환경·CI.** 기존 명령으로 U1·U2 전체 테스트와 라인 커버리지 80%를 실행한다. 환경 설정 범위와 기본값, 배치 실패 진단, SQLite 마이그레이션 및 기존 앱 호환을 기록한다. 원격 CI 및 실제 Raspberry Pi·Google/Firebase 검증은 분리 기록한다. (NFR5, NFR8, NFR9, NFR10)
- [x] Step 19. **실행 문서·추적.** U2 개발 재현, OpenAPI 차이, 시나리오·코드·테스트 연결, 인프라 추적의 자동 검사 실패와 수동 대조 결과를 기록한다. 소스 목록 및 코드 요약을 완료한 뒤 독립 검토를 받는다.

## 계약 반영

| 영역 | 구현 시 명시할 변경 |
| --- | --- |
| 초대 발급과 회수 | 코드 1회 공개, 동일 키 재요청에 안전한 409, Admin 상태 목록과 취소 경로. 초대의 검증·수락·취소·만료 이메일 삭제를 검증한다. |
| 일반 세션과 첫 가입 | U1 로그인/세션을 재사용하되 발급자·주체와 검증된 Google 이메일을 처음 검사하는 수락 경계가 일반 API를 열지 않도록 한다. |
| 회원 관리 | 역할 PATCH의 후임 ID와 역할 제거 DELETE의 `If-Match` 및 선택 `successorAdminId`를 명시한다. 기존 U1 업무·배정에 실제 효과를 적용한다. |
| 계정 및 가구 | 개인 설정 소유자는 현재 계정으로 결정한다. 가구 설정에만 소속·Admin 여부를 반영한다. |
| 정책과 설치 | U2는 연동 명령 경계와 정책 값을 제공한다. 실제 Android 계획과 OS API, 장소 조건 구현은 승인된 U3/U4 범위로 이어진다. |

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
