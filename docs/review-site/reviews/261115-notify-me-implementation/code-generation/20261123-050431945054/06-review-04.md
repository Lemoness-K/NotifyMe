---
layout: review
title: "Review 04"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/code-generation/reviews/review-04.md"
permalink: "/reviews/261115-notify-me-implementation/code-generation/20261123-050431945054/06-review-04/"
---

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T02:06:51Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/delete-journal.ts > DeleteJournal.open 및 initializeAuthority (57–73, 99–104행), src/server/operations/activation.ts > Activation.start | 기동은 활성 DB의 epoch를 확인하고 DB에 있는 최근 커밋 증거를 원장에서 찾는다. 권위 원장의 확정 삭제가 선택한 DB에도 반영됐는지는 역방향으로 검사하지 않는다. 같은 운영 세대의 오래된 DB는 `OperationsGeneration`을 그대로 포함하므로 현재의 완전한 원장과 짝을 이뤄도 이미 삭제한 업무가 있는 상태로 기동할 수 있다. 최초 도입에서도 기존 원장 끝을 바닥으로 채택하기 전에 그 원장의 확정 삭제가 DB에 반영됐는지 확인하지 않는다. 격리 복원으로 만든 `VERIFIED` 기록의 종료 위치도 최초 기동 직전의 권위 증거와 대조하지 않는다. | 공용 리스너와 Worker 시작 전, 초기 기준점 편입 및 복원 최초 기동에서 권위 있는 삭제 효과와 선택된 DB의 커밋 증거·대상 부재를 양방향으로 대조한다. 검증된 후보의 계보·종료 위치·인증값을 활성화 기록에 묶어 최신 원장 경계를 다시 검사한다. 정리된 위치 이전의 효과도 선택된 DB와 연결한 신뢰 증거로 확인한다. 오래된 동일 epoch DB, DB와 일치하지 않는 기존 원장, 검증 뒤 최신점 변경에서 리스너와 Worker가 열리지 않음을 확인한다. | Resolved (reviewer) |
| R-02 | Major | src/server/operations/restore.ts > applyDeletes (33–65행) 및 src/server/auth.ts > SessionService.principal 및 end (116–138행) | 백업에 저장된 `Session`은 옛 DB에서 그대로 활성화된다. 백업 뒤 로그아웃한 세션의 종료 시각이 옛 사본에는 없고, 새 설치 epoch는 서버 세션을 검증하는 데 사용되지 않는다. 복원이 과거 앱 세션의 권한을 되살릴 수 있다. | 공개 전 복원 DB의 기존 앱 세션을 만료 또는 무효화해 재인증을 요구한다. 백업 뒤 로그아웃한 세션이 옛 사본을 복원한 뒤에도 거절되는지 합성 계정으로 검증한다. 복원된 가구 접근 정책을 운영 검증에서 확인한다. | Resolved (reviewer) |
| R-03 | Major | src/server/operations/restore.ts > restoreBackup (75–102행), src/server/operations/backup.ts > select 및 valid (93–100행) | 백업 연령은 복원 초기에 전달받은 시각으로 한 번 확인한다. 사본 복호화·재적용·검증 중 30일 시점이 지나거나 검증 뒤 기동이 늦어진 경우에도 활성화 경로는 사본 만료를 확인하지 않는다. D-058의 만료 후보 공개 차단을 보장하지 못한다. | 30일 경계를 활성화 증거에 묶고 긴 복구의 최종 검증과 최초 공개 시작 직전에도 확인한다. 복구 시작에는 유효했지만 최초 공개 시점에는 만료된 사본을 차단하는 검증을 추가한다. | Resolved (reviewer) |
| R-04 | Minor | src/server/operations/reporting.ts > OperationsReporter.observe (21–50행) | 주간 요약만 켜면 장애 전이를 집계하는 분기가 별도 장애 기록 스위치에 묶여 있어 장애 횟수가 항상 0이다. 두 설정을 독립 활성화할 수 있지만 보고서 값이 로컬 관측을 반영하지 않는다. | 주간 요약에 필요한 상태·횟수 계산과 별도 장애 이벤트 출력을 분리한다. 주간 요약만 켠 경우에도 관측한 장애를 집계하며 별도 장애 기록은 출력하지 않는지 확인한다. | Resolved (reviewer) |
| R-05 | Major | src/server/operations/backup.ts:95,107,124–136 > 백업 선택과 만료 정리 | 30일이 지나면 복원 선택은 차단되지만, 만료 파일 제거는 서비스가 일일 백업 요청을 받아 권위 원장 저장소를 확인한 뒤에만 실행된다. 저장소 장애나 서비스 정지가 지속되면 만료된 암호화 사본이 계속 남아 D-058의 최대 30일 보존을 충족하지 못한다. 현재 보존 테스트는 다음 백업이 성공하는 경우의 물리 삭제를 검증한다. | 만료 파일 정리와 실패 기록을 새 백업 생성 및 원장 정리의 성공 여부와 분리한다. 카탈로그를 인증할 수 없으면 보관 상태를 별도 운영 오류로 드러내고, 합성 시계로 30일을 넘긴 사본이 권위 저장소 장애 중 어떻게 처리되는지 검증한다. | Resolved (reviewer) |
| R-06 | Major | deploy/u5/notify-me-backup-retention.timer:5 및 src/server/operations/backup.ts:26,116 > 정리 주기와 만료 기준 | 사본 생성 시각으로부터 30일 뒤가 만료 시각이다. 타이머는 매시 15분에 실행하므로 보관소가 정상이어도 직전 점검 직후 만료된 사본은 다음 점검까지 남을 수 있다. 그 사이 복원은 차단되지만 실제 사본은 ADR-026의 30일 상한을 넘긴다. | 정상 운영에서 실제 삭제가 상한 안에 들도록 사본별 실행 또는 안전 여유를 둔 정리 시점을 적용한다. 점검 직후 만료되는 사례와 보관소가 복구된 뒤의 정리 결과를 확인한다. | New |
| R-07 | Major | src/server/operations/backup.ts:110–126,154–168,193–196 > 중단된 백업의 작업물 정리 | 파일 이름 확정과 카탈로그 등록 사이에 백업 프로세스가 중단되면 암호화 사본이 목록 밖에 남는다. 그보다 앞서 중단되면 작업 디렉터리에 평문 SQLite가 남을 수 있다. 독립 정리는 카탈로그 항목을 처리하므로 권위 원장 장애가 다음 정상 백업을 막는 동안 이 작업물은 그대로 남는다. U5 NFR2.3.5는 관리 사본과 임시 파일의 제거 확인을 요구한다. | 작업 소유와 게시 진행 상태를 내구성 있게 기록한다. 공용 잠금 아래 관리 중단 작업물을 식별해 정리하고 외부 파일을 보존한다. 최종 이름 확정 직후와 평문 사본 생성 직후의 중단을 각각 시험한다. | New |

> R-05 Reviewer note: 권위 원장이나 앱이 중단돼도 `prune-backups`와 독립 타이머로 카탈로그에 등록된 만료 사본을 정리할 수 있다. 인증 오류 시 파일을 보존하고 구조화 오류를 기록한다. 정리, 새 백업, 복원 파일 읽기가 같은 SQLite 잠금을 쓴다.

### Validation Tool Results

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| 검토 자료 및 변경 내용 재대조 | 이전 요청에서 읽은 계획·질문·요약·테스트 지침·매니페스트·추적표와 동일하다. 운영 명령·잠금·복원·시험 변경도 일치하고, 만료 주기와 게시 순서를 다시 확인했다. | 이전 요청에서 직접 수행한 아래 실행 결과를 이번 검토에 연결했다. |
| `npm exec -- vitest run tests/u5/` | 10:56 KST 실행 종료 0, 5개 파일 36개 통과 | 만료 경계, 키 오류 시 보존, 독립 실행과 잠금 경합 포함 |
| `npm exec -- vitest run tests/u3/http.test.ts` | 10:58 KST 실행 종료 0, 10개 통과 | 삭제 원장 연동 회귀 |
| 승인된 로컬 Chromium 환경의 `npm run verify:u1` | Vitest 10:59 KST 시작, 타입 검사·빌드 및 Vitest 214개 통과, 라인 87.16%. Playwright 3개 통과, U1 HTTPS 재기동 75초 초과로 전체 종료 1 | 현재 요청의 기존 동작에 대한 실행 증거다. U2·U3·U4는 브라우저에서도 통과했다. |
| systemd 캘린더와 원본 유닛 정적 검사 | 캘린더 통과. 원본 유닛은 개발 호스트의 `/usr/bin/node` 부재로 종료 1 | 실제 Pi의 배포 Node 경로와 유닛 실행은 현지 검증 대상이다. |

### Summary

등록된 만료 사본은 백업 생성과 별개로 정리된다. 물리 삭제 시점과 중단된 작업물에 남은 보존 문제를 각각 확인했다.
