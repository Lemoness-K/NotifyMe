## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T08:20:44Z
**Iteration:** 7
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
| R-08 | Major | src/server/operations/files.ts:41 > hashFile | `createReadStream`의 `flags`에 수치 플래그를 전달하지만 현재 프로젝트의 스트림 타입은 문자열을 요구한다. 인가된 전체 체크포인트 명령과 별도 제품 빌드가 모두 TS2322로 중단된다. 변경된 Vitest 선택 규칙을 실행하기 전 실패하므로 현재 결과로 전체 회귀와 커버리지를 판정할 수 없다. | 심볼릭 링크 금지 정책을 유지하면서 현재 타입이 지원하는 파일 열기·스트리밍 경계로 수정하고, 현재 소스에서 빌드와 승인된 전체 체크포인트 명령을 다시 실행한다. | Accepted risk |
| R-09 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/code-generation/code-summary.md > 기존 구현과 문서 변경 이력 재검토 | 개발 실행의 전체 통과 결과를 독립 실행에서 재현하지 못했다. 타입 검사·빌드 뒤 Vitest에서 U2~U5의 7개 파일이 실패했다. 테스트·훅 시간 초과와 Caddy 준비 실패가 있었고, 전체 명령은 Playwright 이전에 중단됐다. U1 전용 검증은 별도로 통과했다. | 현재 환경에서 승인된 전체 체크포인트 명령을 다시 실행하고 성공하거나 실패한 결과를 별도로 기록한다. 같은 실패가 반복되면 해당 Unit의 테스트 초기화와 Caddy 준비 경로를 진단한다. | New |
| R-10 | Minor | tests/e2e/u1/core-flow.spec.ts:37 > stop | 자식 프로세스가 시그널로 이미 종료된 경우 Node.js는 exitCode를 null로 남기고 signalCode만 설정한다. stop은 exitCode만 보고 이미 발생한 종료 이벤트를 다시 기다릴 수 있다. finally에서도 같은 함수를 사용해 임시 DB와 테스트 인증서 정리가 지연될 수 있다. | 종료 확인에 signalCode를 포함하고, 자식이 이미 종료한 경우에도 임시 리소스 정리가 끝나는지 검증한다. | New |

> R-06 Earlier decision: Accepted risk

> R-07 Earlier decision: Accepted risk

### Validation Tool Results

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| npm exec -- vitest run tests/u1/ | 9개 파일, 69개 통과 | U1 전용 단위·통합 검증 |
| 승인된 환경에서 npm run verify:u1 | 종료 코드 1. 타입 검사·빌드 통과. Vitest 194개 통과, 17개 실패. 라인 커버리지 87.26% (2,893 / 3,315). Playwright 미실행 | 실패는 U2~U5 테스트에서 발생했다. Caddy 준비 실패 두 건과 테스트·훅 시간 초과를 확인했다. 커버리지 수치는 실패한 실행의 관측치다. |
| 같은 로컬 Chromium 환경에서 npm exec -- playwright test tests/e2e/u1/ | 1개 통과, 1분 6초 내외 | HTTPS 로그인과 등록, 재시작 후 기존 SQLite 데이터 재조회, 로그아웃 검증 |
| Git 경로와 내용 대조 | 9200199의 AI-DLC 기록 외 변경 45개가 U1 소스 매니페스트와 정확히 일치 | 구현 전 문서 5개의 현재 내용이 7022058 버전과 일치한다. 후속 문서 변경은 U3 b21d350, U4 5bf6785, U5 2035730에서 확인했다. 공통 문서 이력 파일은 리뷰 읽기 범위에서 차단돼 Git을 직접 대조했다. |
| 구조 대조 | 추적표 46개 ID에 중복이 없으며 구현 연결 42개는 모두 U1 매니페스트에 속한다 | 남은 항목은 타 Unit 2개와 대상 Pi 성능 검증 2개다. |

### Summary

U1 구현 커밋의 경로 귀속과 핵심 흐름을 확인했다. U1 단위·통합 및 재시작 브라우저 시험이 통과했고, 승인된 전체 명령은 이번 독립 실행에서 후속 Unit 테스트 실패로 중단됐다.
