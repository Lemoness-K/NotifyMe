## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-18T22:36:54Z
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/web/App.tsx > ReminderList.load 및 ReminderForm.save | 서버가 만료·취소된 세션을 401로 거절해도 두 화면은 오류 문구만 갱신한다. 앱은 로그인 상태를 유지하므로 재로그인 화면이 나타나지 않고, 목록은 이전에 가져온 가구 데이터도 계속 표시한다. | 보호 요청의 401을 공통 처리해 이전 세션과 조회 데이터를 비우고 재인증으로 연결한다. 실제 로그아웃·만료와 공급자 503의 동작을 각각 검증한다. | Resolved (reviewer) |
| R-02 | Major | src/server/provider.ts > realProvider.verifyFirebase 및 realProvider.verifyGoogle | U1 성능 설계에서 정한 공급자 검증 시간 제한과 재시도 범위를 앱 설정에서 제어할 수 없다. 외부 호출이 지연되면 로그인뿐 아니라 Firebase 취소 여부를 확인하는 모든 보호 요청이 SDK 동작에 의존한다. 기존 HTTP 테스트는 즉시 발생하는 모의 503을 검사한다. | 공급자 호출에 실행 환경에서 확인할 수 있는 시간 제한과 재시도 상한을 적용하고, 제한을 넘으면 안전한 503을 반환하는지 검증한다. | Resolved (reviewer) |
| R-03 | Minor | src/web/App.tsx > ReminderForm.save 및 취소 링크 | 등록 작업 키는 폼이 열려 있고 입력이 같은 동안 유지된다. 서버 커밋 후 응답이 끊긴 상태에서 화면을 이동했다가 같은 등록을 재시도하면 새 키가 발급되어 중복 저장될 수 있다. | 저장 결과가 미확정인 동안 원래 입력과 키를 유지하고, 같은 등록의 재시도와 새 등록을 구분한다. | Resolved (reviewer) |
| R-04 | Major | src/web/App.tsx > Session.request (66–76), src/web/client.ts > openSession (89) | Firebase SDK가 요청 전 갱신 과정에서 `auth/user-token-expired` 또는 `auth/user-disabled`로 실패하면 SDK는 사용자를 무효화하고 오류를 다시 던진다. 이 경로에서는 HTTP 401이 발생하지 않아 앱이 로그인 화면으로 돌아가지 않고 이미 조회한 가구 데이터를 계속 표시할 수 있다. | SDK의 확정적인 자격 무효화 신호를 기존 세션 종료 경로에 연결한다. 일시적인 SDK 네트워크 실패는 재시도 가능한 오류로 유지한다. 두 경우를 각각 검증한다. | Resolved (reviewer) |
| R-05 | Minor | src/web/App.tsx > ReminderForm.save (230–232), src/web/client.ts > ApiError 및 api | 공통 API 계약은 429와 503을 일시 오류로 분류하고 미확정 쓰기에 기존 키를 요구한다. 응답 유실 또는 503 뒤 첫 재시도가 429이면 폼이 이미 남겨 둔 키를 지워 이후 재시도가 중복 등록을 만들 수 있다. `Retry-After`로 전달된 대기 조건도 클라이언트에 보존되지 않는다. | 429 뒤 기존 등록 키를 보존하고, 유효한 `Retry-After`가 주어지면 해당 대기 조건을 적용한다. 미확정 응답 뒤 429를 받은 연속 재시도에서 동일 키를 확인한다. | Resolved (reviewer) |
| R-06 | Minor | src/web/App.tsx:156 > ReminderList.load 및 src/web/App.tsx:173 > 다시 시도 버튼 | 공통 응답 규칙의 대기 안내가 리마인더 등록에는 적용됐으나 목록의 수동 재시도에는 적용되지 않았다. 서버가 공급자 장애 때 반환하는 503 및 `Retry-After: 2`(`src/server/http.ts:74`)를 받으면 목록은 오류 코드만 보관하므로 대기 기한보다 이르게 같은 GET을 보낼 수 있다. 공통 HTTP 응답 규칙은 429와 503에서 서버가 지정한 기한을 따르도록 정한다(`inception/contract-design/contract-summary.md:59`). | 목록 요청이 429 또는 503을 반환하면 유효한 재시도 기한을 보존해 사용자에게 표시하고, 기한 전에는 같은 조회를 보내지 않는다. 대기 전후의 요청 횟수를 회귀 테스트로 확인한다. | New |

> R-04 Reviewer note: `src/web/client.ts:118`에서 Firebase 토큰 갱신의 확정적 자격 무효화 세 종류를 401로 변환한다. `src/web/App.tsx:71`의 공통 세션 종료 경로는 기존 보호 화면과 초안을 비우고 진행 중인 요청을 취소한다. 대역 테스트는 일시 네트워크 오류 시 화면과 세션을 유지하고, 확정적 오류 시 HTTP 요청 전에 재로그인으로 전환함을 확인했다.

> R-05 Reviewer note: `src/web/App.tsx:223`의 등록 처리에서 429와 503 이후 같은 본문의 요청 키를 유지한다. 회귀 테스트는 결과 미확정 응답, 429 또는 503, 화면 이동, 같은 키 재제출을 연속으로 검증했다. 초 단위 및 HTTP 날짜 형식은 대기 시간 동안 전송을 막고, 헤더가 없거나 잘못된 경우에는 같은 키로 즉시 재시도할 수 있다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm exec -- vitest run tests/u1/` | 9개 파일, 69개 통과 | Firebase SDK 오류는 대역을 사용했다. 등록 회귀는 대기 전후 요청 횟수와 같은 등록 키를 확인했다. |
| `npm exec -- playwright test tests/e2e/u1/` | 로컬 Chromium 환경에서 1개 통과 | 합성 인증으로 HTTPS 로그인, 등록, 프로세스 재시작 뒤 같은 SQLite 리마인더 조회를 확인했다. |
| `npm run test:coverage -- --coverage.reportsDirectory .local/u1-review-coverage` | 69개 통과, 라인 86.79% (572/659) | 기본 출력 경로의 동시 실행 경합을 피하도록 검토 전용 출력 경로에서 재실행했다. 80% 기준을 충족한다. |

### Summary

기존 두 지적의 대상인 Firebase 토큰 갱신과 리마인더 등록 재시도는 수정됐다. 목록 조회에서 서버가 지정한 대기 기한을 따르는 경미한 지적 한 건이 남았다. 실제 비운영 Firebase·Google 계정, 대상 Raspberry Pi, 원격 CI는 이번 로컬 검토에서 검증 범위 밖이었다.
