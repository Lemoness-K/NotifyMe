## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-19T04:38:30Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | src/server/households.ts > changeMember, lines 272–281 and 299–314 | 본인을 제거하거나 강등하는 Admin 작업은 성공과 동시에 작성자의 Admin 권한을 끝낸다. 성공 응답을 잃고 같은 작업 키를 재사용하면 현재 Admin 권한 검사에서 403을 받아 저장해 둔 완료 결과에 도달하지 못한다. | 같은 인증 주체와 정확히 같은 작업 키·입력에는 이전 완료 사실만 확인할 수 있게 하고 신규 쓰기나 가구 정보 조회 권한은 계속 제한한다. 자기 제거·강등 응답 유실을 회귀 검증한다. | New |
| R-02 | Major | src/web/App.tsx > Session.request and ReminderList, lines 100–107, 153–156 and 212–254; src/web/Settings.tsx > useRead, lines 29–58 | 이미 표시했던 가구 데이터의 재조회가 접근 거부를 받아도 앱은 기존 응답을 유지한다. 이후 프로필 갱신에 의존해 화면을 비우므로 그 요청까지 느리거나 실패하면 소속이 회수된 화면에 이전 데이터가 남는다. | 거부된 읽기의 캐시와 진행 중인 응답을 즉시 폐기한다. 서버가 소속 회수와 역할 부족을 구분해 반환하면 회수된 가구의 다른 화면도 즉시 숨길 수 있다. 프로필 갱신이 지연되거나 실패하는 회귀를 추가한다. | New |
| R-03 | Minor | src/web/Settings.tsx > Invitations, lines 233–269; src/server/households.ts > createInvitation and revokeInvitation, lines 123–164 | 응답을 잃은 초대 발급의 결과를 복구할 때 초대가 이미 수락됐거나 취소·만료됐으면 새 발급 버튼이 잠긴다. 웹은 취소 성공 때만 잠금을 풀지만 서버는 종료된 초대의 취소에 409를 반환한다. | 복구 응답이나 관리자 상태 조회로 초대 상태를 확인하고, 종료된 초대라면 다른 초대를 발급할 수 있게 한다. 활성 초대에는 기존 취소 확인을 적용한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm exec -- vitest run tests/u2/` | PASS. 6개 파일, 54개 테스트 | 합성 신원, 마이그레이션, 가구 권한, 설정 및 브라우저 단위 흐름을 확인했다. |
| `npm exec -- playwright test tests/e2e/u2/` | PASS. Chromium 1개 | 현재 빌드와 로컬 브라우저 환경에서 초대, 계정 선호 공유, 권한 회수를 확인했다. |
| `aidlc engine sensor-traceability --stage code-generation --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/code-generation/traceability.json` | PASS. 지적 0건 | 코드 추적표의 필수 ID와 경로가 해석된다. |
| 전체 `npm run verify:u1` | 이 검토에서 재실행하지 않음 | 검토에 묶인 빌드·생성 파일을 그대로 사용했다. 구현 기록의 전체 123건 및 라인 커버리지 87.27%는 독립 재측정값으로 사용하지 않았다. |

### Summary

U2 핵심 시나리오는 독립 실행에서 통과했다. 권한 변경 성공 응답 복구, 접근을 거부한 뒤의 기존 화면 정리, 비활성 초대 복구를 보완할 수 있다.
