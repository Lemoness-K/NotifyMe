# U4 Android 알림 구현 계획

## Summary

- Builds: 위치 감지 중단 시 오래된 타이머 차단, 정상 프로세스 재생성에서 위치 전이·타이머 복구, 일반 오프라인 복귀에서 기존 인가 예약 유지
- Touches: Android Kotlin 예약·수신·앱 생명주기와 순수 JVM 규칙. R-02·R-05·R-06에 한정
- Tests: 세 건의 실패 재현과 수정 검증, 전체 U1~U4 회귀, TypeScript 전체 라인 80%, 동일 후보 x64 APK와 별도 실기기 증거

## Sources

U4 기능·비기능·인프라 설계, D-097, U2 소속 회수, U3 설치 계획 참여자 계약을 따른다. 신규 또는 재설치 기기가 한도를 넘으면 해당 기기의 장소 감지만 대기시킨다. 시간 알림과 업무 기능은 유지한다. 사용자가 설치별 제외를 확인하고 수요가 한도까지 줄면 해당 설치의 장소 감지를 시작한다.

## Implementation Steps

- [x] Step 1 — 구조와 구성 확인. 기존 U1 인증·HTTPS 세션, U2 가구 소속과 설정, U3 설치 계획 참여자와 피드를 대조한다. ARM64 로컬 JDK와 x64 SDK 경로를 확인한다. **US1.7, US4.6, US6.1.**
- [x] Step 2 — 테스트 실행 준비. `vitest.config.ts`와 `playwright.config.ts`에 U4 경로를 추가한다. `android/gradlew`로 SDK 독립 `android/schedule-core`를 실행하고 Android 앱이 같은 모듈을 포함하게 한다. 첫 Red 전에 U4 수집을 확인한다. **US4.1~US4.7, US5.6.**
- [x] Step 3 — 모델 Red. `tests/u4/storage-model.test.ts`와 `android/schedule-core/src/test/`에 기존 DB 보존, 설치·가구·세대, 계획·제외·outbox 키 및 이벤트별 게시·업로드 상태를 재현한다. **US1.7, US4.4~US4.7.**
- [x] Step 4 — 모델 Green. `prisma/schema.prisma`와 순방향 마이그레이션에 설치·계획·제외·신호·보호 토큰 참조 및 비좌표 이벤트를 추가한다. Kotlin 모델에 저장된 타이머와 개별 이벤트 게시 ID·업로드 상태를 추가한다. **US1.7, US2.7, US4.4~US4.7.**
- [x] Step 5 — 모델 Refactor. 같은 범위 키와 보존 정책을 재사용한다. Android 보호 저장과 백업 제외, 삭제·로그아웃·회수 이후 정리, U1~U3 데이터 보존을 검증한다. **US1.7, US2.7, US4.4.**
- [x] Step 6 — 저장소 Red. `tests/u4/repository.test.ts`에서 99·100·101 슬롯, 최초 대기와 활성 설치 거절, 동시 쓰기, 여러 설치 격리, 예약 없는 설치 회수, 늦은 epoch·제외 복원 충돌을 재현한다. **US1.7, US2.2, US2.6~US2.7, US3.4, US4.5, US6.6.**
- [x] Step 7 — 저장소 Green. 서버에서 설치·계획·outbox 저장소와 U3 계획 포트를 연결한다. U2 회수 트랜잭션에서 보유 설치를 확보해 계획 유무와 독립적으로 회수 신호를 커밋한다. 한도 초과에서 관련 저장을 원자적으로 거부한다. **US1.7, US2.2, US2.6~US2.7, US3.4, US4.5, US6.6.**
- [x] Step 8 — 저장소 Refactor. 범위와 세대의 저장·키 사용을 통합하고 후보 페이지와 변경 인덱스, 만료·삭제 표지, 동일 슬롯 재집계를 검증한다. **US2.7, US4.5~US4.7.**
- [x] Step 9 — 규칙 Red. `tests/u4/notification-rules.test.ts`와 `android/schedule-core/src/test/`에서 이전 scope 제거, 권한 회수 및 더 최신 FULL, 24시간 경계, 정확 알람 fallback, 장소 타이머 재시작·중복 콜백, FCM 만료·재시도를 재현한다. **US4.1~US4.4, US4.6~US4.7.**
- [x] Step 10 — 규칙 Green. `android/schedule-core/src/main/`에 재조정·타이머·ID와 복구 규칙을, `android/app/src/main/`에 Kotlin OS 어댑터·보호 저장소·고정 API 브리지·FCM 수신을 둔다. 서버는 FCM 변경 신호를 커밋 후 발송하고 내구 점유, 잔여 TTL, 성공·실패·만료를 기록한다. **US4.1~US4.4, US4.6~US4.7, US5.6, US6.4.**
- [x] Step 11 — 규칙 Refactor. 이전 scope 정리를 재시작 가능하게 하고 정리 직후 인가된 HTTPS로 현재 권한과 epoch·revision을 확인한다. 회수나 더 최신 FULL에서 대기분을 폐기하고, 연결 오류에서는 확인될 때까지 대기한다. FCM 미수신·재부팅과 재실행을 시험한다. **US1.7, US4.3, US4.7.**
- [x] Step 12 — API Red. `tests/u4/http.test.ts`에 설치 소유권·가구 회수, 세대·커서, 위치 후보·제외 갱신, 이벤트 만료, 토큰 교체, 외부 origin과 잘못된 nonce, 기존 웹 로그인을 시험한다. **US1.7, US4.3~US4.7.**
- [x] Step 13 — API Green. `src/server/http.ts`와 새 U4 코드에 설치 등록·sync·위치 제외·이벤트를 연결한다. 공유 OpenAPI에 기존 challenge·session 교환과 실패 응답을 명시한다. 두 ID 토큰의 audience·subject·auth_time·nonce, 보호 쿠키와 챌린지의 일회 소비를 기존 U1 검증으로 처리한다. 네이티브 API를 고정 HTTPS 호스트와 허용 동작으로 한정하고 자격은 WebView에 넘기지 않는다. **US1.7, US4.4~US4.7.**
- [x] Step 14 — API Refactor. 기존 구조화 오류와 요청 ID를 재사용한다. 합성 계정과 FCM 대역으로 회귀를 실행한다. **US4.5~US4.7, US6.3.**
- [x] Step 15 — 웹 Red. `tests/u4/web-interactions.test.tsx`, `tests/e2e/u4/installation-notifications.spec.ts`에서 대기→제외 확인→감시, 다른 설치 격리, 저장 초안 재시도, OS 권한, ko/en과 화면 재배치를 시험한다. **US4.3, US4.5~US4.6, US5.6, US6.1~US6.4.**
- [x] Step 16 — 웹 Green. `src/web/`에 공유 설치 설정, 장소 용량 관리·제외·재시도, 번역과 플랫폼 기능 경계를 연결한다. **US4.3, US4.5~US4.6, US5.6, US6.1~US6.4.**
- [x] Step 17 — 웹 Refactor. 카탈로그와 기존 UI 상태·오류 현지화를 재사용하고 키보드·터치, 다른 기기 및 범위 변경 회귀를 확인한다. **US4.3, US5.6, US6.1~US6.4.**
- [x] Step 18 — 환경·CI. `package.json`에 별도 JVM 검증을 추가한다. 로컬 ARM64 JDK와 Gradle wrapper, Node와 Capacitor 패키지, SDK 버전은 잠금 파일·검증 설정과 체크섬으로 고정한다. 작업공간용 도구만 준비한다. `.github/workflows/android-u4-ci.yml`의 x64에서 APK 조립과 Android 단위 시험을 합성 구성으로 실행한다. 검증 브랜치는 이 실행에만 사용하며 기존 승인 경로로 master를 갱신한다. **US4.1~US4.7.**
- [x] Step 19 — 결과 기록. U4 전용 TS·브라우저·JVM, 전체 회귀·라인 80%, x64 SDK 조립을 구분해 기록한다. 두 실기기의 권한·부팅·잠금 화면·FCM·지오펜스 결과는 실행 증거를 확보한 항목만 통과로 기록한다. **US4.1~US4.7, US5.6, US6.6.**

### 재검토에서 남은 세 건의 수정

- [x] Step 20 — 기존 Kotlin JVM과 x64 Android 단위 테스트 수집을 확인한다. 필요한 경우 기존 테스트 설정에 새 시나리오를 연결하고 실제 OS 호출은 대역으로 둔다. **US4.1~US4.3, US4.7.**
- [x] Step 21 — Red. 위치 OFF·ON과 이미 대기 중인 만료의 순서, 제공자 사용 불가 뒤 재등록, 같은 부팅의 프로세스 재생성 뒤 첫 실제 전이와 타이머, 일반 오프라인 화면 복귀 및 강제 종료·회수의 FULL 전후를 검증한다. **US4.1~US4.3, US4.7.**
- [x] Step 22 — Green R-02. OFF·지오펜스 사용 불가를 수신하면 대기 작업보다 먼저 위치 감지의 무효화를 가시화하고 중단을 저장한다. 이전 등록의 콜백·타이머를 차단하고 위치 감지가 회복되면 새 등록의 초기 관측으로 기준을 복구한다. **US4.2, US4.3.**
- [x] Step 23 — Green R-05. 같은 부팅의 현재 권한·설치 범위·등록 ID를 확인해 저장한 위치 상태와 마감을 복구한다. 정상 프로세스 재생성에서는 유효한 콜백을 처리하고, 실제 감지 중단이나 범위가 바뀐 경우에는 이전 이벤트를 차단한다. **US4.2, US4.7.**
- [x] Step 24 — Green R-06. 일반 화면 복귀에서는 연결 오류가 인가된 기존 예약을 차단하지 않게 한다. 강제 종료, 근거가 부족한 최초 화면 진입, 명시적 회수 및 범위 변경의 재인가 경계를 유지한다. API 35 이상 시작 증거, 이전 OS의 증거 부족, 정지 해제 뒤 부팅 신호를 각각 검증한다. **US4.1~US4.3, US4.7.**
- [x] Step 25 — Refactor와 검증. 전체 앱 명령, U4 집중 테스트와 독립 리뷰를 실행하고, 정확히 같은 코드의 x64 SDK 단위 시험과 APK를 확인한다. 실제 기기로 확인할 항목은 별도 증거에 남긴다. **US4.1~US4.3, US4.7.**

- [x] Step 26 — 현재 Android 알림 구현과 문서 변경 이력 재검증. U4 구현 커밋 `5bf6785`를 기준으로 알림·스케줄링 설계와 결정 등록부의 D-097(신규 설치의 장소 수용 한도)을 소스 매니페스트와 독립 리뷰에 포함한다. 결정 등록부의 U3·U5 변경분은 Git 이력으로 구분한다. U4 전용 서버·웹·Kotlin 검증과 승인된 전체 앱 검증을 실행한다. Android APK·SDK 및 실기기 검증은 현재 실행한 증거와 기존 실행 이력을 구분해 결과에 남긴다.

## Verification boundaries

로컬 ARM64에서는 작업공간에 준비한 JDK와 Gradle wrapper를 사용하고 Android SDK 빌드는 x64 CI에서 확인한다. 실제 로그인·FCM·센서 동작은 승인된 테스트 Firebase 및 두 Android 기기 검증이 필요하다. U5 실제 백업 복원과 U3 삭제 원장 관련 지적은 별도 범위로 유지한다.

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
