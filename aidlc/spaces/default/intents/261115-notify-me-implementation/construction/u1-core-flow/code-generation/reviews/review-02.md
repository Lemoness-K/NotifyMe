## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-18T09:17:59Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/web/App.tsx > ReminderList.load 및 ReminderForm.save | 서버가 만료·취소된 세션을 401로 거절해도 두 화면은 오류 문구만 갱신한다. 앱은 로그인 상태를 유지하므로 재로그인 화면이 나타나지 않고, 목록은 이전에 가져온 가구 데이터도 계속 표시한다. | 보호 요청의 401을 공통 처리해 이전 세션과 조회 데이터를 비우고 재인증으로 연결한다. 실제 로그아웃·만료와 공급자 503의 동작을 각각 검증한다. | Resolved (reviewer) |
| R-02 | Major | src/server/provider.ts > realProvider.verifyFirebase 및 realProvider.verifyGoogle | U1 성능 설계에서 정한 공급자 검증 시간 제한과 재시도 범위를 앱 설정에서 제어할 수 없다. 외부 호출이 지연되면 로그인뿐 아니라 Firebase 취소 여부를 확인하는 모든 보호 요청이 SDK 동작에 의존한다. 기존 HTTP 테스트는 즉시 발생하는 모의 503을 검사한다. | 공급자 호출에 실행 환경에서 확인할 수 있는 시간 제한과 재시도 상한을 적용하고, 제한을 넘으면 안전한 503을 반환하는지 검증한다. | Resolved (reviewer) |
| R-03 | Minor | src/web/App.tsx > ReminderForm.save 및 취소 링크 | 등록 작업 키는 폼이 열려 있고 입력이 같은 동안 유지된다. 서버 커밋 후 응답이 끊긴 상태에서 화면을 이동했다가 같은 등록을 재시도하면 새 키가 발급되어 중복 저장될 수 있다. | 저장 결과가 미확정인 동안 원래 입력과 키를 유지하고, 같은 등록의 재시도와 새 등록을 구분한다. | Resolved (reviewer) |
| R-04 | Major | src/web/App.tsx > Session.request (66–76), src/web/client.ts > openSession (89) | Firebase SDK가 요청 전 갱신 과정에서 `auth/user-token-expired` 또는 `auth/user-disabled`로 실패하면 SDK는 사용자를 무효화하고 오류를 다시 던진다. 이 경로에서는 HTTP 401이 발생하지 않아 앱이 로그인 화면으로 돌아가지 않고 이미 조회한 가구 데이터를 계속 표시할 수 있다. | SDK의 확정적인 자격 무효화 신호를 기존 세션 종료 경로에 연결한다. 일시적인 SDK 네트워크 실패는 재시도 가능한 오류로 유지한다. 두 경우를 각각 검증한다. | New |
| R-05 | Minor | src/web/App.tsx > ReminderForm.save (230–232), src/web/client.ts > ApiError 및 api | 공통 API 계약은 429와 503을 일시 오류로 분류하고 미확정 쓰기에 기존 키를 요구한다. 응답 유실 또는 503 뒤 첫 재시도가 429이면 폼이 이미 남겨 둔 키를 지워 이후 재시도가 중복 등록을 만들 수 있다. `Retry-After`로 전달된 대기 조건도 클라이언트에 보존되지 않는다. | 429 뒤 기존 등록 키를 보존하고, 유효한 `Retry-After`가 주어지면 해당 대기 조건을 적용한다. 미확정 응답 뒤 429를 받은 연속 재시도에서 동일 키를 확인한다. | New |

> R-01 Reviewer note: 보호 API의 HTTP 401은 로그인 상태, 가구 데이터, 입력 및 대기 요청을 정리한다. 화면 상호작용 회귀 테스트에서 503 이후 화면 유지, 401 이후 재로그인 화면, 늦게 완료된 응답 폐기를 확인했다.

> R-02 Reviewer note: 서버 검증에 설정 가능한 기한과 앱 재시도 상한을 적용했다. 공급자 SDK 대역을 사용한 테스트에서 Firebase·Google의 공통 기한과 재시도 예산, 만료 시 503, 늦은 응답에 의한 쓰기 금지, 잘못된 증거의 401을 확인했다.

> R-03 Reviewer note: 503 이후 등록 화면을 다시 열면 제출 내용을 복원하고 같은 본문으로 재제출할 때 같은 키를 사용한다. 변경한 입력은 별도 키를 받고 검증 실패나 등록 성공 뒤 해당 시도를 정리한다. 로그아웃과 계정 전환에서 이전 작업이 남지 않는지 확인했다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm exec -- vitest run tests/u1/` | 9개 파일, 60개 통과 | 세션 응답 처리, 공급자 검증 기한, 등록 키의 기존 회귀 사례를 확인했다. |
| `npm exec -- playwright test tests/e2e/u1/` | 로컬 Chromium 설정으로 1개 통과 | 합성 자격을 사용해 HTTPS 로그인과 등록, 서버 재시작 뒤 SQLite 재조회를 확인했다. |
| `npm run test:coverage` | 60개 통과, 라인 82.58% (517/626) | 로컬에서 승인된 80%를 충족했다. |
| 코드 추적표 대상 확인 | 46개 항목 중 OK 42개, N/A 2개, Deferred 2개. OK의 파일 대상 모두 존재 | 추적표의 파일 대상이 구현에 존재한다. |

### Summary

이전 세 지적의 대상이었던 HTTP 401, 공급자 검증 기한과 재시도, 화면 전환 뒤 같은 등록의 재시도는 각각 수정 및 검증됐다. 실제 Firebase 토큰 갱신에서 세션이 무효화되는 경로와 미확정 쓰기의 재시도가 429를 받는 경로에는 별도 보완이 필요하다. 실제 Firebase·Google과 Raspberry Pi에서의 검증은 수행하지 않았다.
