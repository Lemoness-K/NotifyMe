# U1 코드 작성 계획

## Summary

- Builds: 최초 가구·관리자 설정, 웹 로그인·가구 인가, 시간 리마인더 등록 및 SQLite 재조회
- Touches: 공유 웹·서버·SQLite 스키마, U1 테스트, 앱 CI와 인증 계약
- Tests: 구성요소별 10~15건 목표의 단위·통합·브라우저 종단 테스트와 전체 라인 커버리지 확인

## Sources

U1의 `functional-spec.md`, `entities.md`, `rules.md`, 승인된 `contract-summary.md`, NFR·인프라 설계, `unit-of-work-story-map.md`, `bolt-plan.md`, `team-practices.md`를 사용한다. U1 역할만 구현하며 U2~U5의 검토용 초안은 해당 단위 작업 시 참조한다.

## Steps

- [x] Step 1. **프로젝트와 계약 준비.** TypeScript 공유 웹, NestJS 서버, SQLite 저장소의 최소 구조를 만들고 실행·설정·영속 데이터를 분리한다. 새 로그인 증거의 교환 경로, 가구 접근 오류 및 환경별 인증 제한을 계약의 변경으로 명시한다. 기존 테스트 문서의 라인 커버리지 표현을 승인된 80% 기준과 맞춘다. 인프라 자동 추적 검사에서 인식하지 못한 이전 설계 ID는 바로잡아 재검증하거나, 정식 변경 경로가 필요한 경우 실패 상태와 별도 대조 결과를 단위 검증에 명시한다. (US1.1 인증, US4.6 공유 상태)
- [x] Step 2. **테스트 실행 준비.** Vitest 및 Playwright의 설정과 잠금 파일을 준비한다. U1 전용 경로와 합성 인증·임시 SQLite·로컬 단일 출처 HTTPS 테스트 환경을 제공한다. 테스트 명령이 파일과 설정을 제대로 찾아 실행되는지 확인한 뒤 각 Red를 시작한다. (모든 U1 검증)
- [x] Step 3. **데이터 모델 Red.** `tests/u1/storage-model.test.ts`에서 최초 설정 일회성, 관계 범위, 롤백과 원자적 리마인더·회차 저장의 실패 사례를 작성한다. (US1.2 가구 격리, US1.3 초기화, US2.1 생성)
- [x] Step 4. **데이터 모델 Green.** 초기 버전 마이그레이션으로 사용자·세션·가구·리마인더·담당자·시간 조건·회차·요청 결과 테이블 및 키를 적용한다. Step 3을 통과시킨다.
- [x] Step 5. **데이터 모델 Refactor.** 인가 경계를 표현하는 키와 테스트용 데이터 생성을 정리하고 테스트를 유지한다.
- [x] Step 6. **저장소 Red.** `tests/u1/repository.test.ts`에서 가구 범위의 읽기, 등록 경합·작업 키 충돌, 정상 재시작 뒤 재조회의 실패를 확인한다. (US1.2 가구 격리, US1.6 공동 관리, US2.1 생성, US4.6 공유 상태)
- [x] Step 7. **저장소 Green.** 짧은 트랜잭션과 가구 범위가 있는 조회·쓰기, 안정된 페이지와 idempotency 결과 저장을 구현한다.
- [x] Step 8. **저장소 Refactor.** 객체 권한과 가구별 조회의 반복을 줄이고 임시 DB와 재시작 테스트를 유지한다.
- [x] Step 9. **업무 로직 Red.** `tests/u1/auth-session.test.ts`와 `tests/u1/reminder-rules.test.ts`에 로그인 요청·공급자 응답 불일치, 증거 재사용, 두 세션 중 한쪽만 종료, 잘못된 요청자, DST와 입력 오류 사례를 작성한다. (US1.1 인증, US1.3 초기화, US2.1 생성, US6.3 원문)
- [x] Step 10. **업무 로직 Green.** 처음 관리자 설정, 외부 신원 연결과 세션 발급·취소, 가구 인가, 시간 조건과 첫 회차, 요청자·담당자 기본값을 구현한다. 브라우저의 로그인 요청과 공급자 서명 응답을 일회용 값으로 묶고, 검증한 Google 주체와 같은 Firebase 인증 신원인지 확인한다. 로컬 어댑터는 이 계약을 합성 증거로 재현한다.
- [x] Step 11. **업무 로직 Refactor.** 신원 검증과 업무 검증 경계를 정리하고, 인증 공급자 장애와 잘못된 자격 증명을 구분한다.
- [x] Step 12. **API Red.** `tests/u1/http.test.ts`에 로그인 요청 발급, 세션 쿠키·출처·CSRF, 로그아웃, 다른 가구 조회 거부, 401·503 구분과 구조화 오류, 중복 POST 방지 검증을 작성한다. (US1.1 인증, US1.2 가구 격리, US1.6 공동 관리, US2.1 생성, US6.3 오류)
- [x] Step 13. **API Green.** 승인된 등록·목록·상세 계약 및 구현 전 검토한 세션 계약을 제공한다. 테스트 인증이 활성화되거나 실제 공급자 설정이 빠진 대상 모드에서는 시작을 거부한다. 보호된 데이터 또는 사용자 입력 원문을 API와 Caddy의 진단 로그에 남기지 않는다.
- [x] Step 14. **API Refactor.** 공통 인증·오류·라우트 처리를 정리하고, 운영 경로와 HTTPS 구성의 접근 검사를 유지한다.
- [x] Step 15. **웹 Red.** `tests/u1/web.test.ts`와 `tests/e2e/u1/core-flow.spec.ts`에 로그인, 입력 오류 유지, 등록·재조회, 재시작 후 조회, 여러 너비에서 키보드·터치 흐름을 설계한다. (US2.1 생성, US4.6 공유 상태, US5.6 사용성, US6.3 현지화)
- [x] Step 16. **웹 Green.** 공용 로그인·목록·시간 리마인더 폼, 한국어·영어 문구 리소스와 접근 가능한 오류 상태를 구현한다. 사용자 원문을 유지하고 앱 API와 한 출처로 연결한다.
- [x] Step 17. **웹 Refactor.** 화면 상태·서버 조회·권한 경계를 정리하고 종단 검증을 유지한다.
- [x] Step 18. **실행과 CI 구성.** 공용 타입 검사, U1 전용 테스트, 종단 실행 및 전체 커버리지의 CI 결과를 커밋에 연결한다. 앱 전용 작업은 기존 GitHub 리뷰 사이트 배포와 분리한다. 대상 ARM64 호환성을 개발 호스트 결과와 분리해 기록한다. (NFR8.2 ARM64, NFR9.1~9.3 개발·검증, NFR10.2 비공개 운영)
- [x] Step 19. **검증 기록과 문서.** 실행법, 계약 변화, 스토리별 구현·검증 위치 및 실패 결과를 기록한다. U1 완료 검증 명령은 실행 준비 후 사용자에게 요청한다. 비운영 Firebase 실제 연동은 승인된 테스트 자격이 준비되면 별도 검증한다. (U1 전체)

## 세션 계약의 구현 확인

Google ID 토큰의 서명된 nonce를 브라우저의 로그인 요청 값과 대조하는 안을 검증한다. Firebase Bearer 토큰을 별도로 확인하고 같은 Google 주체와 연결돼 있는지 비교한다. 서로 다른 요청의 응답, 서로 다른 주체, 이미 사용한 증거는 거부한다. 대상 로그인 방식이 승인된 환경에서 요청 연결을 보장하는지 확인하고, 공급자 공식 흐름에 없는 동작을 가정하지 않는다. [Google의 nonce 계약](https://developers.google.com/identity/openid-connect/reference) · [Firebase의 Google 인증 연결](https://firebase.google.com/docs/auth/web/google-signin)

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
