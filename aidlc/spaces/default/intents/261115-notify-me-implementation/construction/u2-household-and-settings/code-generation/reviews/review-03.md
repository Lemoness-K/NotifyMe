## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T12:17:24Z
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/households.ts > changeMember, lines 272–281 and 299–314 | 본인을 제거하거나 강등하는 Admin 작업은 성공과 동시에 작성자의 Admin 권한을 끝낸다. 성공 응답을 잃고 같은 작업 키를 재사용하면 현재 Admin 권한 검사에서 403을 받아 저장해 둔 완료 결과에 도달하지 못한다. | 같은 인증 주체와 정확히 같은 작업 키·입력에는 이전 완료 사실만 확인할 수 있게 하고 신규 쓰기나 가구 정보 조회 권한은 계속 제한한다. 자기 제거·강등 응답 유실을 회귀 검증한다. | Unresolved |
| R-02 | Major | src/web/App.tsx > Session.request and ReminderList, lines 100–107, 153–156 and 212–254; src/web/Settings.tsx > useRead, lines 29–58 | 이미 표시했던 가구 데이터의 재조회가 접근 거부를 받아도 앱은 기존 응답을 유지한다. 이후 프로필 갱신에 의존해 화면을 비우므로 그 요청까지 느리거나 실패하면 소속이 회수된 화면에 이전 데이터가 남는다. | 거부된 읽기의 캐시와 진행 중인 응답을 즉시 폐기한다. 서버가 소속 회수와 역할 부족을 구분해 반환하면 회수된 가구의 다른 화면도 즉시 숨길 수 있다. 프로필 갱신이 지연되거나 실패하는 회귀를 추가한다. | Unresolved |
| R-03 | Minor | src/web/Settings.tsx > Invitations, lines 233–269; src/server/households.ts > createInvitation and revokeInvitation, lines 123–164 | 응답을 잃은 초대 발급의 결과를 복구할 때 초대가 이미 수락됐거나 취소·만료됐으면 새 발급 버튼이 잠긴다. 웹은 취소 성공 때만 잠금을 풀지만 서버는 종료된 초대의 취소에 409를 반환한다. | 복구 응답이나 관리자 상태 조회로 초대 상태를 확인하고, 종료된 초대라면 다른 초대를 발급할 수 있게 한다. 활성 초대에는 기존 취소 확인을 적용한다. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/code-generation/traceability.json > BR2.14 (설정 정의 비활성화·폐기) | `src/server/settings.ts:40`은 정의 변경 정책을 메타데이터로 제공한다. 현재 테스트는 그 필드의 존재를 확인하며, 설정 정의를 비활성화·폐기할 때 값 보존과 마이그레이션 실패 시 전환 중단까지 검증한 근거는 없다. | 현재 검증 범위를 카탈로그 정책 선언까지로 명시한다. 실제 정의 전환을 구현하는 작업에서 기존 값 보존 및 불완전한 마이그레이션 차단의 검증을 연결한다. | New |

> R-01 Reviewer note: `src/server/households.ts:273`의 `changeMember`는 현재 Admin 권한을 확인한 뒤 완료 결과를 조회한다. 자기 강등·제거가 커밋되고 응답이 유실되면 같은 작성자가 완료 여부를 확인할 수 없다. 신규 쓰기에는 현재 권한을 유지하면서, 정확히 일치하는 기존 요청의 완료 여부만 해당 작성자에게 확인할 수 있게 하고 응답 유실을 회귀 시험한다.

> R-02 Reviewer note: `src/web/App.tsx:136`은 가구 접근 거부 시 프로필 재조회를 시작하고 실패를 무시한다. 같은 파일의 목록과 `src/web/Settings.tsx:29`의 읽기 상태는 요청 거부 시 이전 값을 지우지 않는다. 소속 회수가 확인된 가구의 데이터와 진행 중 응답을 폐기하고, 프로필 재조회 지연·실패에서도 이전 데이터가 사라지는지 검증한다.

> R-03 Reviewer note: `src/web/Settings.tsx:233`에서 이미 발급된 초대 ID를 복구하면 새 발급을 막으며, 취소가 성공할 때만 잠금을 해제한다. `src/server/households.ts:148`은 종료된 초대의 취소에 409를 반환한다. 관리자에게 확인된 종료 상태를 반영해 같은 화면에서 새 발급을 허용하고, 활성 초대는 기존 취소 절차를 유지한다.

### Validation Tool Results

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| `npm exec -- vitest run tests/u2/` | 6개 파일, 54개 통과 | U2 전용 단위·통합 검사. 이번 실행에서 Caddy 준비 완료. |
| 승인된 `npm run verify:u1` | 종료 코드 0. 타입 검사·빌드 통과, Vitest 32개 파일·211개 통과, 라인 커버리지 87.26%, Playwright 4개 통과 | U2의 가구 초대·표시 설정 공유·소속 회수 브라우저 시나리오가 18.3초에 통과했다. U1 서버 재시작과 U3·U4 브라우저 시나리오도 통과했다. |
| Git 경로 및 추적표 대조 | U2 매니페스트 31개 경로가 `8fc86d3`의 AI-DLC 기록 외 경로와 일치한다. 추적표 61개 ID에 중복과 누락이 없고, 52개 OK 항목의 13개 고유 대상 경로가 추적된다. | 대상 Pi 성능·자원 검증 2개는 후속으로 명시돼 있다. U1의 기존 브라우저 시험은 공유 회귀 근거로 전체 실행에서 확인했다. |

### Summary

U2 전용 시험과 통합 회귀가 모두 통과했고 검토 목록이 구현 이력과 일치한다. 자기 권한 변경의 완료 확인, 회수 시 화면의 이전 데이터 제거, 종료된 초대의 발급 복구는 보완이 필요하다.
