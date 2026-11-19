# U3 리마인더 업무 구현 계획

## Summary

- Builds: 공유 리마인더 편집, 반복 회차, 완료 검증, 보관과 영구 삭제, 할 일과 이력
- Touches: SQLite 순방향 마이그레이션, 기존 서버·공유 웹, U3 테스트, Pi 서비스 예제
- Tests: 주요 컴포넌트별 단위·통합·종단 검증 10~15건 목표, 기존 U1/U2 회귀, 전체 라인 커버리지 80%

## Sources

U3 기능·비기능·인프라 설계와 유닛 스토리 매핑을 적용한다. D-094는 현재 활성 가구 구성원이면서 담당자가 아닌 사람만 검증자로 지정한다. D-095는 검증자가 응답하기 전에 제출자가 직접 철회할 수 있도록 한다. D-096은 검증자 소속 회수 시 회차를 미완료로 되돌리고, 새 검증자를 지정해 다시 요청하도록 한다. 세 동작은 이력과 권한 검사를 공유한다.

## Implementation Steps

- [x] Step 1 — 기존 진입점과 데이터 경계 확인. 기존 U1 생성·목록·상세의 입력, U2 활성 소속·설정 및 `WorkChanges` 참조, OpenAPI의 회차 명령·호환 필드와 U3 스토리 담당을 대조한다. 기존 데이터가 있는 마이그레이션용 시험 DB를 준비한다. **US1.6, US1.7, US2.2, US2.3, US6.1.**
- [x] Step 2 — 테스트 실행 준비. `vitest.config.ts`, `playwright.config.ts`의 선택 범위에 U3를 추가하고 두 명령이 U3만 찾는지 테스트 수집 또는 최소 시험으로 확인한다. 테스트마다 DB와 원장을 격리한다. **US5.6, US6.3.**
- [x] Step 3 — 모델 Red. `tests/u3/storage-model.test.ts`에서 U1/U2 보존, 구간과 회차 고유 키, 명령·검증의 충돌 방지, 삭제 증거 및 업무 내용 제거를 재현한다. **US2.3, US2.7, US3.1~US3.3, US7.1.**
- [x] Step 4 — 모델 Green. `prisma/schema.prisma`와 새 순방향 마이그레이션에 규칙 구간·예외·상태·검증 시도·감사·피드 및 DB 커밋 증거를 추가한다. 기존 업무·배정·가구 키와 데이터를 유지한다. **US2.2~US2.7, US3.1~US3.3, US7.1, US8.4.**
- [x] Step 5 — 모델 Refactor. 기존 제약과 시간 표현을 재사용하고 상태·스코프 키를 검토한다. 빈 DB와 U2 DB에서 다시 마이그레이션한다. **US1.6, US2.2, US3.1.**
- [x] Step 6 — 저장소 Red. `tests/u3/repository.test.ts`, `tests/u3/delete-journal.test.ts`에서 가구 범위와 안정 커서, 경쟁 전이, 중첩 쓰기 롤백, 잘못된 재시도, 원장 실패 구간 및 백업 대역의 독점 차단을 시험한다. **US1.7, US2.7, US4.5, US5.1~US5.5, US7.2, US8.4.**
- [x] Step 7 — 저장소 Green. `src/server/repository.ts`, `src/server/storage.ts`와 필요 시 U3 저장소·원장 파일을 확장한다. 같은 작업 ID의 REQUESTED, 업무 삭제와 피드·DB 커밋 증거, COMMITTED를 순서대로 확인한다. 미확정 증거를 보존한다. U5 대역에서는 정확한 기존 요청만 종결하고, 기준점 발행을 유효한 스냅샷 시도와 현재 독점 핸들에 묶어 시간 초과·연결 종료·재시작 이후 뒤늦은 발행을 막는다. **US2.7, US4.5, US5.4, US8.4.**
- [x] Step 8 — 저장소 Refactor. 기존 멱등 결과·조건부 revision·로컬 경합 처리를 사용하고 원장·운영 DB·피드 만료를 각각 검증한다. 닫힌 진입의 재개와 다중 호출의 상호 배제를 확인한다. U5 인수 조건으로 유효 스냅샷 기준점을 기준으로 정리 범위를 판단하고, 보존 상한으로 증거가 사라진 사본은 복원 불가 상태와 경고로 기록하도록 명시한다. **US2.7, US4.5, US8.4.**
- [x] Step 9 — 업무 규칙 Red. `tests/u3/recurrence.test.ts`, `tests/u3/occurrence-actions.test.ts`에서 DST 간격·중첩, 월말·종료일, 편집 범위, 현재 회차와 이전 검증 대기, 일반 완료 취소, 여러 담당자, 철회·승인·소속 회수의 경합, 무담당 후 재지정을 시험한다. **US1.7, US2.4~US2.6, US3.1~US3.5, US6.8, US7.1~US7.2.**
- [x] Step 10 — 업무 규칙 Green. `src/server/reminders.ts`, `src/server/time.ts`, `src/server/household-runtime.ts` 및 필요 시 반복·회차 전이 모듈에서 계산과 공동 상태 전이를 구현한다. 가구 범위로 조건을 검증하고 U2의 위치 정책과 `WorkChanges`, U4 설치 계획 참여 포트를 같은 저장 경계에 연결한다. U4 대역 실패에서 업무·이력을 롤백한다. **US1.6~US1.7, US2.2~US2.6, US3.1~US3.5, US4.1~US4.2, US4.5, US6.6~US6.8, US7.1~US7.2.**
- [x] Step 11 — 업무 규칙 Refactor. 상태 전환·시간 적용·요청 권한을 공유하고 오래된 revision, 종료 검증, 기존 확정 이력, 재실행 결과를 재검증한다. **US2.4~US2.6, US3.2, US7.2.**
- [x] Step 12 — API Red. `tests/u3/http.test.ts`에서 실제 세션·가구·업무, 작업 키와 revision, 권한 회수 뒤 응답, 커서 오용, 검증 요청의 정렬·건수·동작, 삭제 확인과 재시도 시나리오를 검증한다. **US1.6~US1.7, US2.3~US2.7, US5.1~US5.5, US7.1~US7.2.**
- [x] Step 13 — API Green. `src/server/http.ts`에 상세·수정·전이·이력·보관함·삭제 경로를 연결한다. U3 응답은 대기 건수와 호출자별 `allowedActions`를 채운다. 검증 대기 전용 그룹은 가장 이른 OPEN 요청 시각과 회차 ID를 기준으로 서버에서 정렬한다. 필터 커서는 사용자·가구·업무·필터에 묶는다. 소속과 권한은 쓰기 시 새로 판정한다. **US2.3~US2.7, US5.1~US5.5, US7.1~US7.2.**
- [x] Step 14 — API Refactor. 기존 오류 구조, route 가드, DTO·페이지 처리, 요청 ID 로그를 재사용하고 스코프·부작용·이력 노출을 재검증한다. **US1.6, US5.4, US6.3, US7.2.**
- [x] Step 15 — 웹 Red. `tests/u3/web-interactions.test.tsx`와 `tests/e2e/u3/reminder-workflows.spec.ts`에서 목록·편집·회차·검증·보관·삭제와 회귀를 시험한다. U2의 다른 계정 둘 이상으로 종료 전이를 확인한다. 최소 지원 주장 없이 여러 CSS 뷰포트와 줌·키보드·터치·색 이외 단서, ko/en 원문 보존을 확인한다. **US2.3~US2.7, US5.1~US5.6, US6.3, US7.1~US7.2.**
- [x] Step 16 — 웹 Green. `src/web/App.tsx`, `client.ts`, `messages.ts`, `styles.css`와 필요 시 U3 화면을 확장하고 기존 SPA 경로 제공을 업데이트한다. 검증 대기와 현재 회차를 둘 다 보여주고 서버 동작만 화면에 반영한다. 기존 응답에 새 필드가 없으면 대응 버튼을 숨긴다. 영구 삭제 전 확인을 받고 실패 후 작성 상태와 안내를 보존한다. **US2.3~US2.7, US3.2, US5.1~US5.6, US6.3, US7.1~US7.2.**
- [x] Step 17 — 웹 Refactor. 앱의 언어·표시 시간대·공유 폼·상태 안내를 사용하고 좁고 넓은 레이아웃, 오래된 응답, 가구 전환을 재검증한다. **US5.1~US5.6, US6.3.**
- [x] Step 18 — 운영 경로와 회귀. 기존 CI 검증에 U3를 연결하고 필요할 때 `deploy/u1/notify-me.service.example`와 서버 설정에 전용 원장 경로 및 권한을 추가한다. U3의 첫 원장 초기화와 이미 초기화한 설치의 원장 누락·교체를 구별한다. 후자는 읽기·쓰기 및 복구 증거를 확인하고 서비스 시작을 차단하는 사례로 검증한다. ARM64 개발 환경에서 Node 24 native 로드·마이그레이션·트랜잭션을 시험한다. Pi의 실제 배포·부하 및 복원 훈련 결과는 별도 기록한다. **US2.7, US4.5, US5.6, US8.4.**
- [x] Step 19 — 결과 정리. TypeScript 검사·빌드, U3 전용 검증, 기존 U1/U2 포함 전체 회귀 및 커버리지 80%를 실행한다. 공개 API 및 문서의 구현 차이를 정리하고 Red/Green, 소스 매니페스트와 테스트 증거를 기록한다. **US1.6, US2.3, US5.6, US7.2, US8.4.**

## Unit boundaries

U3는 실제 알림 설치와 OS 재조정을 U4 포트에 넘긴다. U5는 암호화 백업과 실제 복원·재적용 훈련을 담당한다. 검증 요청의 자동 만료·재알림·추가 전달의 결정은 열린 상태로 둔다.

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
