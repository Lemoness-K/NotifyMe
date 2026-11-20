## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T08:03:27Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/households.ts > changeMember, lines 272–281 and 299–314 | 본인을 제거하거나 강등하는 Admin 작업은 성공과 동시에 작성자의 Admin 권한을 끝낸다. 성공 응답을 잃고 같은 작업 키를 재사용하면 현재 Admin 권한 검사에서 403을 받아 저장해 둔 완료 결과에 도달하지 못한다. | 같은 인증 주체와 정확히 같은 작업 키·입력에는 이전 완료 사실만 확인할 수 있게 하고 신규 쓰기나 가구 정보 조회 권한은 계속 제한한다. 자기 제거·강등 응답 유실을 회귀 검증한다. | Unresolved |
| R-02 | Major | src/web/App.tsx > Session.request and ReminderList, lines 100–107, 153–156 and 212–254; src/web/Settings.tsx > useRead, lines 29–58 | 이미 표시했던 가구 데이터의 재조회가 접근 거부를 받아도 앱은 기존 응답을 유지한다. 이후 프로필 갱신에 의존해 화면을 비우므로 그 요청까지 느리거나 실패하면 소속이 회수된 화면에 이전 데이터가 남는다. | 거부된 읽기의 캐시와 진행 중인 응답을 즉시 폐기한다. 서버가 소속 회수와 역할 부족을 구분해 반환하면 회수된 가구의 다른 화면도 즉시 숨길 수 있다. 프로필 갱신이 지연되거나 실패하는 회귀를 추가한다. | Unresolved |
| R-03 | Minor | src/web/Settings.tsx > Invitations, lines 233–269; src/server/households.ts > createInvitation and revokeInvitation, lines 123–164 | 응답을 잃은 초대 발급의 결과를 복구할 때 초대가 이미 수락됐거나 취소·만료됐으면 새 발급 버튼이 잠긴다. 웹은 취소 성공 때만 잠금을 풀지만 서버는 종료된 초대의 취소에 409를 반환한다. | 복구 응답이나 관리자 상태 조회로 초대 상태를 확인하고, 종료된 초대라면 다른 초대를 발급할 수 있게 한다. 활성 초대에는 기존 취소 확인을 적용한다. | Unresolved |

> R-01 Reviewer note: `src/server/households.ts`의 `changeMember`는 277–279행에서 현재 Admin 권한을 검사한 뒤 이전 결과를 조회한다. 본인 제거·강등 성공 후 재시도에서 동일한 작업의 완료 확인에 도달하지 못하는 순서는 그대로다.

> R-02 Reviewer note: `src/web/App.tsx` 136–138행은 가구 접근 거부 시 비동기 `refreshProfile`만 시작한다. 목록 재조회와 `src/web/Settings.tsx`의 `useRead` 오류 경로는 이전 데이터를 비우지 않는다. 프로필 갱신이 지연되거나 실패한 경우에는 이전 내용이 계속 표시된다.

> R-03 Reviewer note: `src/web/Settings.tsx`의 초대 회복 ID를 취소 성공 시에만 비운다. 종료된 초대에 대한 취소는 `src/server/households.ts` 155–161행에서 409를 반환하므로 같은 화면에서 재발급이 계속 차단된다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 소스 매니페스트, SHA-256 | 재검토 스냅샷의 31개 경로 모두 일치. 이전 U2 스냅샷과 비교해 16개 경로 변경 | U3·U4의 공용 경계 변경을 대조했다. 설치 회수는 가구 소속 비활성화 전에 같은 트랜잭션에서 기록된다. 기존 초대·구성원·설정의 권한 경계를 넓히는 새 변경은 발견하지 않았다. |
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS. 종료 코드 0, Vitest 178건, Chromium 4건, 라인 커버리지 86.34% | 타입 검사, SQLite 회귀, 웹 브라우저 흐름을 확인했다. |
| `npm exec -- vitest run tests/u2/` | PASS. 파일 6개, 54건 | 가구·초대·설정·HTTP·저장소 테스트를 실행했다. |
| `npm exec -- playwright test tests/e2e/u2/` | PASS. U2 브라우저 1건. 전체 검증과 동일한 Chromium 환경 사용 | 초대 수락, 저장된 계정 설정 공유, 구성원 접근 회수를 확인했다. |

### Summary

공용 코드 변경에서 새 U2 회귀를 발견하지 않았다. 기존의 작업 결과 재확인, 접근 회수 화면 정리, 종료된 초대의 재발급 지적은 각각 미해결 상태로 남는다.
