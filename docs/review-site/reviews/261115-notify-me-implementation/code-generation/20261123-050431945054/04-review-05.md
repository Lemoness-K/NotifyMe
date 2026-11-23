---
layout: review
title: "Review 05"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u3-reminder-workflows/code-generation/reviews/review-05.md"
permalink: "/reviews/261115-notify-me-implementation/code-generation/20261123-050431945054/04-review-05/"
---

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T14:35:53Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/occurrence-actions.ts > authorizedOccurrenceActions, lines 25–36 | 무담당 회차에서는 지정 검증자도 `COMPLETE`를 받아 본인 요청을 제출할 수 있다. 이후 같은 사람에게 `APPROVE`와 `REJECT`가 허용되며 `src/server/work-service.ts`의 쓰기도 제출자와 응답자가 다른지 검사하지 않는다. 빌드된 권한 함수에서 같은 사용자의 제출과 승인 허용을 확인했다. | 무담당이어도 현재 검증자의 제출을 거부하고 대기 요청의 제출자 본인에게 승인·거절을 일관되게 거부한다. 호출자별 허용 동작과 서버 쓰기 모두 이를 반영하고 실제 무담당 회차에서 회귀를 검증한다. | Resolved (reviewer) |
| R-02 | Major | src/server/work-service.ts > WorkService.edit, lines 212–229 | 전체 반복 변경에서 새 규칙은 원래 시작 시각부터 생성되며 기존 규칙의 PENDING만 제거한다. `src/server/work-scheduling.ts`는 규칙 ID를 회차 고유 키에 넣으므로 기존 완료·놓침·건너뜀 회차를 남긴 상태에서 같은 시각의 새 회차를 만들고 이력을 중복시킨다. | 기존 확정 회차와 대기 검증의 ID와 상태를 보존하고 새 규칙이 동일한 과거 예정 회차를 다시 만들지 않도록 논리적 회차를 대조한다. 과거에 완료한 뒤 전체 규칙을 수정하고 작업을 재실행하는 사례를 검증한다. | Resolved (reviewer) |
| R-03 | Major | src/server/work-service.ts > WorkService.delete and removeWithEvidence, lines 331–369 | DB 커밋 후 원장 확정에 실패했을 때 같은 작업 ID를 마무리하는 유일한 호출 경로가 시작과 트랜잭션 안에서 원래 제출자의 현재 소속을 요구한다. 그 사람이 재시도하지 않거나 접근이 회수되면 일치하는 내구 커밋 증거가 있어도 미확정 상태가 남고, 이후 백업 기준점 발행이 계속 막힌다. | 최초 삭제의 현재 소속 검사를 유지한다. 이미 내구 커밋된 작업은 서버 또는 인가된 운영자가 원장과 DB 증거만 대조해 종결할 수 있게 하고, 소속 회수 뒤에도 새 업무 변경을 하지 않고 복구하는 사례를 검증한다. | Resolved (reviewer) |
| R-04 | Major | prisma/schema.prisma > ReminderCommandResult, lines 272–282 | 업무 삭제 시 CREATE 작업의 멱등 결과도 외래 키 cascade로 지워진다. 최초 등록에 사용했던 같은 키와 입력이 늦게 재전송되면 `WorkService.command`가 새로운 등록으로 처리해 사용자가 삭제한 원문과 업무를 새 ID로 만든다. | 원문과 결과 본문을 제거하면서 호환되는 재시도 기간에 필요한 최소 작업 키·입력 검증 정보·삭제 상태를 보존한다. 삭제 후 동일 CREATE의 지연 재전송은 새 업무를 생성하거나 삭제된 원문을 돌려주지 않는지 검증한다. | Resolved (reviewer) |
| R-05 | Major | src/server/work-service.ts > WorkService.removeWithEvidence, lines 365–410 | 최초 삭제가 가구 접근 검사를 통과하고 원장에 REQUESTED를 기록한 뒤, 운영 DB 트랜잭션 진입 전 구성원 소속이 회수될 수 있다. 트랜잭션의 권한 거절은 DB 삭제 전에 발생하지만 종결 분기는 이 오류를 처리하지 않는다. 유지보수는 일치하는 커밋 증거가 있을 때만 종결하므로 이 경합에서는 미확정 행이 남는다. 원장은 미확정 상태를 정리하지 않으며, 검증된 운영 복구로 종결될 때까지 공유 U5 백업 기준점의 발행이 막힌다. | 새로 시작한 요청이 DB에 쓰기 전에 거절됐음이 입증된 경우 요청을 ABORTED로 종결한다. 이미 기록된 작업의 재시도에서는 이전 커밋 여부를 먼저 증거로 확인하고 권한 거절만으로 종결을 추정하지 않는다. REQUESTED 직후 소속 회수에 대해 업무가 보존되고 이후 백업 기준점을 발행할 수 있는지 검증한다. | Resolved (reviewer) |
| R-06 | Major | src/server/household-runtime.ts > startWorkMaintenance, 117–132행 및 src/server/http.ts > createApp, 403–405행 | 새 설치 정리 트랜잭션이 삭제 원장 복구보다 먼저 실행되며 두 작업의 오류 처리 경계가 같다. 설치 정리가 실패하면 해당 회차의 원장 복구·정리가 모두 건너뛰어진다. 설치 쪽 오류가 반복되면 운영 DB 커밋 증거가 이미 있는 경우도 미확정 원장 상태에 남아 백업 기준점 발행이 지연될 수 있다. | 설치 정리 실패를 별도 기록하고 원장 복구가 계속 실행되게 한다. 설치 정리에서 오류를 반환하더라도 확인 가능한 삭제 커밋이 확정되는지 회귀 검증한다. | Resolved (reviewer) |
| R-07 | Minor | tests/e2e/u3/reminder-workflows.spec.ts > 반응형 웹 검증 41–62행 | U3 웹 테스트는 여러 CSS 뷰포트와 키보드·터치 입력을 확인한다. U3 계획 Step 15가 명시한 브라우저 확대 상태의 접근성 검증 결과는 현재 테스트와 결과 기록에서 찾을 수 없다. | 브라우저 확대 상태에서 폼과 회차 검증 조작을 사용할 수 있는지 확인하고 결과를 기록한다. | Unresolved |
| R-08 | Major | src/server/work-scheduling.ts:63 > createRule | PR-AC-048의 종료일은 규칙 시간대의 시작일과 같거나 이후여야 한다. 입력 처리는 `endOn`의 날짜 형식만 확인하고, `createRule`은 시작일과의 순서를 검사하지 않고 저장한다. 이후 `nextOccurrence`가 첫 회차부터 생성을 중단하므로 새 업무가 회차 없이 생성되거나 수정한 규칙의 새 구간이 비어 있을 수 있다. | 규칙 시간대의 현지 시작일과 종료일을 저장 전에 비교해 종료일이 더 빠르면 요청을 거절한다. 생성과 수정의 역전 입력에 변경이 남지 않고 시작일과 같은 종료일은 허용되는지 검증한다. | New |
| R-09 | Major | src/server/work-service.ts:228 > edit의 반복 구간 교체 | PR-AC-049는 범위 편집에서도 회차의 식별자와 감사 이력 보존을 요구한다. 구간이 교체되면 코드가 기존 미완료 회차를 삭제하고, `src/server/work-scheduling.ts:98`의 회차 생성은 새 규칙 ID와 새 회차 ID를 사용한다. 같은 예정 시각에 살아남아야 할 회차도 ID가 바뀌며 삭제된 회차의 예외와 연결 완료 기록도 연쇄 삭제될 수 있다. | 새 규칙에도 존재하는 발생분은 기존 ID와 관련 기록을 재사용하고, 더 이상 발생하지 않는 회차도 이력을 남기는 방식으로 처리한다. 종료일만 늘리는 경우와 구간 분할에서 미완료 회차의 ID와 기존 예외가 유지되는지 검증한다. | New |

> R-07 Reviewer note: Chromium에서 실제 200% 탭 확대를 실행하지 못한 이유가 구현 결과에 남아 있다. `tests/e2e/u3/reminder-workflows.spec.ts:41`은 340 CSS px에서 입력과 조작을 검증하고, 59–62행은 영구 삭제 뒤 빈 보관함에서 320·420·850 CSS px의 가로 넘침을 확인한다. 실제 페이지 확대 상태에서 폼 입력과 회차 검증을 별도로 확인해야 한다.

### Validation Tool Results

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| `npm exec -- vitest run tests/u3/` | 7개 파일, 38개 통과 | U3 전용 확인 |
| 승인된 로컬 Chromium 환경의 `npm run verify:u1` | 종료 코드 0. 타입 검사와 빌드 통과. Vitest 32개 파일, 211개 통과. 전체 라인 커버리지 87.26% | 80% 기준 충족 |
| 전체 명령의 Playwright | 4개 모두 통과, U3 시나리오 10.5초 | U3 편집·일반 완료·보관·영구 삭제 및 뷰포트 확인. 실제 페이지 확대 증거는 R-07 참고 |
| Git 변경 경로와 소스 매니페스트 대조 | `b21d350`의 AI-DLC 기록 외 39개 변경 경로와 매니페스트가 일치 | 마스터 설계·제품 요구사항·결정 등록부의 D-094 검증자 자격, D-095 요청 철회, D-096 검증자 소속 회수는 U3 변경이다. 공유 등록부의 D-097 설치 용량은 `5bf6785`, D-098 운영 보고는 `2035730`에서 추가됐다. |
| 추적표 경로 대조 | 137개 항목 중 OK 123, N/A 12, Deferred 2 | OK 대상은 모두 U3 매니페스트에 포함된다. 반복 규칙과 회차의 실제 구현 범위는 위 지적을 참고한다. |

### Summary

현재 소스의 전체 검증과 U3 경로 귀속을 확인했다. 반복 종료일의 입력 검증과 반복 편집의 회차 보존은 제품 수용 기준과 차이가 남아 있다.
