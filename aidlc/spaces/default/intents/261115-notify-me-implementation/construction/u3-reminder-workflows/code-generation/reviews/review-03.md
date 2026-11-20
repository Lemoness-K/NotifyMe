## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T08:11:26Z
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/occurrence-actions.ts > authorizedOccurrenceActions, lines 25–36 | 무담당 회차에서는 지정 검증자도 `COMPLETE`를 받아 본인 요청을 제출할 수 있다. 이후 같은 사람에게 `APPROVE`와 `REJECT`가 허용되며 `src/server/work-service.ts`의 쓰기도 제출자와 응답자가 다른지 검사하지 않는다. 빌드된 권한 함수에서 같은 사용자의 제출과 승인 허용을 확인했다. | 무담당이어도 현재 검증자의 제출을 거부하고 대기 요청의 제출자 본인에게 승인·거절을 일관되게 거부한다. 호출자별 허용 동작과 서버 쓰기 모두 이를 반영하고 실제 무담당 회차에서 회귀를 검증한다. | Resolved (reviewer) |
| R-02 | Major | src/server/work-service.ts > WorkService.edit, lines 212–229 | 전체 반복 변경에서 새 규칙은 원래 시작 시각부터 생성되며 기존 규칙의 PENDING만 제거한다. `src/server/work-scheduling.ts`는 규칙 ID를 회차 고유 키에 넣으므로 기존 완료·놓침·건너뜀 회차를 남긴 상태에서 같은 시각의 새 회차를 만들고 이력을 중복시킨다. | 기존 확정 회차와 대기 검증의 ID와 상태를 보존하고 새 규칙이 동일한 과거 예정 회차를 다시 만들지 않도록 논리적 회차를 대조한다. 과거에 완료한 뒤 전체 규칙을 수정하고 작업을 재실행하는 사례를 검증한다. | Resolved (reviewer) |
| R-03 | Major | src/server/work-service.ts > WorkService.delete and removeWithEvidence, lines 331–369 | DB 커밋 후 원장 확정에 실패했을 때 같은 작업 ID를 마무리하는 유일한 호출 경로가 시작과 트랜잭션 안에서 원래 제출자의 현재 소속을 요구한다. 그 사람이 재시도하지 않거나 접근이 회수되면 일치하는 내구 커밋 증거가 있어도 미확정 상태가 남고, 이후 백업 기준점 발행이 계속 막힌다. | 최초 삭제의 현재 소속 검사를 유지한다. 이미 내구 커밋된 작업은 서버 또는 인가된 운영자가 원장과 DB 증거만 대조해 종결할 수 있게 하고, 소속 회수 뒤에도 새 업무 변경을 하지 않고 복구하는 사례를 검증한다. | Resolved (reviewer) |
| R-04 | Major | prisma/schema.prisma > ReminderCommandResult, lines 272–282 | 업무 삭제 시 CREATE 작업의 멱등 결과도 외래 키 cascade로 지워진다. 최초 등록에 사용했던 같은 키와 입력이 늦게 재전송되면 `WorkService.command`가 새로운 등록으로 처리해 사용자가 삭제한 원문과 업무를 새 ID로 만든다. | 원문과 결과 본문을 제거하면서 호환되는 재시도 기간에 필요한 최소 작업 키·입력 검증 정보·삭제 상태를 보존한다. 삭제 후 동일 CREATE의 지연 재전송은 새 업무를 생성하거나 삭제된 원문을 돌려주지 않는지 검증한다. | Resolved (reviewer) |
| R-05 | Major | src/server/work-service.ts > WorkService.removeWithEvidence, lines 365–410 | 최초 삭제가 가구 접근 검사를 통과하고 원장에 REQUESTED를 기록한 뒤, 운영 DB 트랜잭션 진입 전 구성원 소속이 회수될 수 있다. 트랜잭션의 권한 거절은 DB 삭제 전에 발생하지만 종결 분기는 이 오류를 처리하지 않는다. 유지보수는 일치하는 커밋 증거가 있을 때만 종결하므로 이 경합에서는 미확정 행이 남는다. 원장은 미확정 상태를 정리하지 않으며, 검증된 운영 복구로 종결될 때까지 공유 U5 백업 기준점의 발행이 막힌다. | 새로 시작한 요청이 DB에 쓰기 전에 거절됐음이 입증된 경우 요청을 ABORTED로 종결한다. 이미 기록된 작업의 재시도에서는 이전 커밋 여부를 먼저 증거로 확인하고 권한 거절만으로 종결을 추정하지 않는다. REQUESTED 직후 소속 회수에 대해 업무가 보존되고 이후 백업 기준점을 발행할 수 있는지 검증한다. | Unresolved |
| R-06 | Major | src/server/household-runtime.ts > startWorkMaintenance, 117–132행 및 src/server/http.ts > createApp, 403–405행 | 새 설치 정리 트랜잭션이 삭제 원장 복구보다 먼저 실행되며 두 작업의 오류 처리 경계가 같다. 설치 정리가 실패하면 해당 회차의 원장 복구·정리가 모두 건너뛰어진다. 설치 쪽 오류가 반복되면 운영 DB 커밋 증거가 이미 있는 경우도 미확정 원장 상태에 남아 백업 기준점 발행이 지연될 수 있다. | 설치 정리 실패를 별도 기록하고 원장 복구가 계속 실행되게 한다. 설치 정리에서 오류를 반환하더라도 확인 가능한 삭제 커밋이 확정되는지 회귀 검증한다. | New |

> R-05 Reviewer note: `src/server/work-service.ts` 372–376행에서 별도 원장에 요청을 기록한 뒤 운영 DB의 소속을 다시 검사한다. 407–411행의 실패 종결 처리에는 이 시점의 접근 거부가 여전히 포함되지 않는다. 커밋 증거가 없는 요청을 유지보수가 자동 확정하지 않는 아래 427–442행도 그대로다. U5 백업 기준점 검증 전에 기존 요구 조치를 적용해야 한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 소스 매니페스트, SHA-256 | 재검토 스냅샷의 36개 경로 모두 일치. 직전 U3 리뷰와 비교해 12개 경로 변경 | 마이그레이션·설치 참여자·공용 HTTP와 웹·유지보수 경계의 변경을 대조했다. |
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS. 종료 코드 0, Vitest 178건, Chromium 4건, 라인 커버리지 86.34% | 타입 검사, 제품 빌드와 전체 회귀를 확인했다. |
| `npm exec -- vitest run tests/u3/` | PASS. 파일 7개, 38건 | 회차·업무·원장 및 SQLite 기존 사례를 확인했다. |
| `npm exec -- playwright test tests/e2e/u3/` | PASS. U3 브라우저 1건. 전체 검증과 동일한 Chromium 환경 사용 | 반응형 웹에서 업무 수정, 완료, 보관 및 영구 삭제 흐름을 확인했다. |

### Summary

정상 리마인더 흐름은 검증을 통과했다. 기존 소속 회수 경합 외에 설치 정리 실패가 삭제 원장 복구를 건너뛰는 운영 경계 보완이 필요하다.
