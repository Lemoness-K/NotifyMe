## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T04:36:34Z
**Iteration:** 5
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/web/App.tsx > ReminderList.load 및 ReminderForm.save | 서버가 만료·취소된 세션을 401로 거절해도 두 화면은 오류 문구만 갱신한다. 앱은 로그인 상태를 유지하므로 재로그인 화면이 나타나지 않고, 목록은 이전에 가져온 가구 데이터도 계속 표시한다. | 보호 요청의 401을 공통 처리해 이전 세션과 조회 데이터를 비우고 재인증으로 연결한다. 실제 로그아웃·만료와 공급자 503의 동작을 각각 검증한다. | Resolved (reviewer) |
| R-02 | Major | src/server/provider.ts > realProvider.verifyFirebase 및 realProvider.verifyGoogle | U1 성능 설계에서 정한 공급자 검증 시간 제한과 재시도 범위를 앱 설정에서 제어할 수 없다. 외부 호출이 지연되면 로그인뿐 아니라 Firebase 취소 여부를 확인하는 모든 보호 요청이 SDK 동작에 의존한다. 기존 HTTP 테스트는 즉시 발생하는 모의 503을 검사한다. | 공급자 호출에 실행 환경에서 확인할 수 있는 시간 제한과 재시도 상한을 적용하고, 제한을 넘으면 안전한 503을 반환하는지 검증한다. | Resolved (reviewer) |
| R-03 | Minor | src/web/App.tsx > ReminderForm.save 및 취소 링크 | 등록 작업 키는 폼이 열려 있고 입력이 같은 동안 유지된다. 서버 커밋 후 응답이 끊긴 상태에서 화면을 이동했다가 같은 등록을 재시도하면 새 키가 발급되어 중복 저장될 수 있다. | 저장 결과가 미확정인 동안 원래 입력과 키를 유지하고, 같은 등록의 재시도와 새 등록을 구분한다. | Resolved (reviewer) |
| R-04 | Major | src/web/App.tsx > Session.request (66–76), src/web/client.ts > openSession (89) | Firebase SDK가 요청 전 갱신 과정에서 `auth/user-token-expired` 또는 `auth/user-disabled`로 실패하면 SDK는 사용자를 무효화하고 오류를 다시 던진다. 이 경로에서는 HTTP 401이 발생하지 않아 앱이 로그인 화면으로 돌아가지 않고 이미 조회한 가구 데이터를 계속 표시할 수 있다. | SDK의 확정적인 자격 무효화 신호를 기존 세션 종료 경로에 연결한다. 일시적인 SDK 네트워크 실패는 재시도 가능한 오류로 유지한다. 두 경우를 각각 검증한다. | Resolved (reviewer) |
| R-05 | Minor | src/web/App.tsx > ReminderForm.save (230–232), src/web/client.ts > ApiError 및 api | 공통 API 계약은 429와 503을 일시 오류로 분류하고 미확정 쓰기에 기존 키를 요구한다. 응답 유실 또는 503 뒤 첫 재시도가 429이면 폼이 이미 남겨 둔 키를 지워 이후 재시도가 중복 등록을 만들 수 있다. `Retry-After`로 전달된 대기 조건도 클라이언트에 보존되지 않는다. | 429 뒤 기존 등록 키를 보존하고, 유효한 `Retry-After`가 주어지면 해당 대기 조건을 적용한다. 미확정 응답 뒤 429를 받은 연속 재시도에서 동일 키를 확인한다. | Resolved (reviewer) |
| R-06 | Minor | src/web/App.tsx:156 > ReminderList.load 및 src/web/App.tsx:173 > 다시 시도 버튼 | 공통 응답 규칙의 대기 안내가 리마인더 등록에는 적용됐으나 목록의 수동 재시도에는 적용되지 않았다. 서버가 공급자 장애 때 반환하는 503 및 `Retry-After: 2`(`src/server/http.ts:74`)를 받으면 목록은 오류 코드만 보관하므로 대기 기한보다 이르게 같은 GET을 보낼 수 있다. 공통 HTTP 응답 규칙은 429와 503에서 서버가 지정한 기한을 따르도록 정한다(`inception/contract-design/contract-summary.md:59`). | 목록 요청이 429 또는 503을 반환하면 유효한 재시도 기한을 보존해 사용자에게 표시하고, 기한 전에는 같은 조회를 보내지 않는다. 대기 전후의 요청 횟수를 회귀 테스트로 확인한다. | Resolved (reviewer) |
| R-07 | Major | tests/u4/notification-rules.test.ts > import at line 4 | 작업 중인 U4 테스트가 아직 없는 `src/server/notification-outbox.ts`를 참조한다. 전체 체크포인트 명령은 이 파일을 포함한 타입 검사에서 TS2307로 종료한다. 독립 실행한 U1 테스트와 현재 소스의 제품 빌드는 통과했다. | U4의 진행 중인 변경을 보존하면서 완결된 검증 대상으로 분리하거나 U4 모듈 구현을 마친 뒤, 해당 체크포인트에 대해 기록된 전체 명령을 다시 실행한다. | Resolved (reviewer) |

> R-06 Earlier decision: Accepted risk

> R-07 Reviewer note: 알림 발송 모듈이 구현되어 테스트의 참조가 해결됐다. 기록된 전체 명령이 타입 검사, 빌드 및 테스트를 완료했다.

> R-07 Earlier decision: Accepted risk

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm exec -- vitest run tests/u1/` | PASS, 9 files and 69 tests | 현재 체크아웃에서 U1 단위·통합 회귀를 독립 실행했다. |
| `npm exec -- playwright test tests/e2e/u1/` | PASS, 1 test | 현재 빌드의 HTTPS 로그인과 리마인더 등록, 서버 재시작 후 SQLite 재조회를 확인했다. |
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS, exit 0 | 타입 검사와 서버·웹 빌드, Vitest 177건, 라인 커버리지 86.33%, Playwright 4건을 확인했다. |

### Summary

직전 검토의 소스 스냅샷과 현재 U1 소유 파일을 대조했다. 설치 연동이 추가된 공유 서버와 웹에서 U1의 로그인·업무 흐름 회귀를 발견하지 않았으며, 기록된 전체 검증 명령도 통과했다.
