## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T23:34:54Z
**Iteration:** 3
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/delete-journal.ts > DeleteJournal.open 및 initializeAuthority (57–73, 99–104행), src/server/operations/activation.ts > Activation.start | 기동은 활성 DB의 epoch를 확인하고 DB에 있는 최근 커밋 증거를 원장에서 찾는다. 권위 원장의 확정 삭제가 선택한 DB에도 반영됐는지는 역방향으로 검사하지 않는다. 같은 운영 세대의 오래된 DB는 `OperationsGeneration`을 그대로 포함하므로 현재의 완전한 원장과 짝을 이뤄도 이미 삭제한 업무가 있는 상태로 기동할 수 있다. 최초 도입에서도 기존 원장 끝을 바닥으로 채택하기 전에 그 원장의 확정 삭제가 DB에 반영됐는지 확인하지 않는다. 격리 복원으로 만든 `VERIFIED` 기록의 종료 위치도 최초 기동 직전의 권위 증거와 대조하지 않는다. | 공용 리스너와 Worker 시작 전, 초기 기준점 편입 및 복원 최초 기동에서 권위 있는 삭제 효과와 선택된 DB의 커밋 증거·대상 부재를 양방향으로 대조한다. 검증된 후보의 계보·종료 위치·인증값을 활성화 기록에 묶어 최신 원장 경계를 다시 검사한다. 정리된 위치 이전의 효과도 선택된 DB와 연결한 신뢰 증거로 확인한다. 오래된 동일 epoch DB, DB와 일치하지 않는 기존 원장, 검증 뒤 최신점 변경에서 리스너와 Worker가 열리지 않음을 확인한다. | Resolved (reviewer) |
| R-02 | Major | src/server/operations/restore.ts > applyDeletes (33–65행) 및 src/server/auth.ts > SessionService.principal 및 end (116–138행) | 백업에 저장된 `Session`은 옛 DB에서 그대로 활성화된다. 백업 뒤 로그아웃한 세션의 종료 시각이 옛 사본에는 없고, 새 설치 epoch는 서버 세션을 검증하는 데 사용되지 않는다. 복원이 과거 앱 세션의 권한을 되살릴 수 있다. | 공개 전 복원 DB의 기존 앱 세션을 만료 또는 무효화해 재인증을 요구한다. 백업 뒤 로그아웃한 세션이 옛 사본을 복원한 뒤에도 거절되는지 합성 계정으로 검증한다. 복원된 가구 접근 정책을 운영 검증에서 확인한다. | Resolved (reviewer) |
| R-03 | Major | src/server/operations/restore.ts > restoreBackup (75–102행), src/server/operations/backup.ts > select 및 valid (93–100행) | 백업 연령은 복원 초기에 전달받은 시각으로 한 번 확인한다. 사본 복호화·재적용·검증 중 30일 시점이 지나거나 검증 뒤 기동이 늦어진 경우에도 활성화 경로는 사본 만료를 확인하지 않는다. D-058의 만료 후보 공개 차단을 보장하지 못한다. | 30일 경계를 활성화 증거에 묶고 긴 복구의 최종 검증과 최초 공개 시작 직전에도 확인한다. 복구 시작에는 유효했지만 최초 공개 시점에는 만료된 사본을 차단하는 검증을 추가한다. | Resolved (reviewer) |
| R-04 | Minor | src/server/operations/reporting.ts > OperationsReporter.observe (21–50행) | 주간 요약만 켜면 장애 전이를 집계하는 분기가 별도 장애 기록 스위치에 묶여 있어 장애 횟수가 항상 0이다. 두 설정을 독립 활성화할 수 있지만 보고서 값이 로컬 관측을 반영하지 않는다. | 주간 요약에 필요한 상태·횟수 계산과 별도 장애 이벤트 출력을 분리한다. 주간 요약만 켠 경우에도 관측한 장애를 집계하며 별도 장애 기록은 출력하지 않는지 확인한다. | Resolved (reviewer) |
| R-05 | Major | src/server/operations/backup.ts:95,107,124–136 > 백업 선택과 만료 정리 | 30일이 지나면 복원 선택은 차단되지만, 만료 파일 제거는 서비스가 일일 백업 요청을 받아 권위 원장 저장소를 확인한 뒤에만 실행된다. 저장소 장애나 서비스 정지가 지속되면 만료된 암호화 사본이 계속 남아 D-058의 최대 30일 보존을 충족하지 못한다. 현재 보존 테스트는 다음 백업이 성공하는 경우의 물리 삭제를 검증한다. | 만료 파일 정리와 실패 기록을 새 백업 생성 및 원장 정리의 성공 여부와 분리한다. 카탈로그를 인증할 수 없으면 보관 상태를 별도 운영 오류로 드러내고, 합성 시계로 30일을 넘긴 사본이 권위 저장소 장애 중 어떻게 처리되는지 검증한다. | New |

### Validation Tool Results

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| `npm exec -- vitest run tests/u5/` | 종료 코드 0, 5개 파일 33개 통과 | 합성 SQLite 백업·복원, 삭제 원장, 백업 수명과 공개 차단 |
| `npm exec -- vitest run tests/u3/http.test.ts` | 종료 코드 0, 1개 파일 10개 통과 | 삭제 관련 기존 HTTP 회귀 |
| 승인된 로컬 Chromium 환경에서 `npm run verify:u1` | 종료 코드 0. 타입 검사·빌드 통과, Vitest 211개·Playwright 4개 통과, 라인 커버리지 87.26% (2,893/3,315) | 전체 애플리케이션 자동 검증. 실제 Raspberry Pi 부팅·부하나 운영 데이터 전환은 이 실행 범위 밖이다. |
| Git과 소스 매니페스트 대조 | `2035730`의 AI-DLC 기록 외 변경 35개와 매니페스트 35개가 정확히 일치. 해당 프로젝트 파일의 이후 변경 없음 | 운영 설계 및 결정 등록부의 D-098(운영 호스트의 주간 요약·장애 기록)과 Q-070(전달 범위) 변경을 U5에 연결했다. |
| 소스 경계와 추적 대조 | 레지스트리 버전 1, 개별 문서 경로 5개. 다섯 문서 모두 `7022058`과 Delivery Planning 승인 시점의 내용과 일치. 추적 ID 49개 중 45개 구현 연결이 U5 매니페스트에 있음 | 앱 소스·테스트·배포 경로는 제외 목록에 없다. 2개 항목은 U3 직접 삭제 범위이며 2개는 대상 Pi에서 실측할 항목이다. 전체 Code Generation 완료 판정은 별도다. |
| 임시 작업 확인 | 실행 전후 `.u1-db-*` 목록 동일 | 기존 네 경로를 보존했고 새로 남은 경로가 없다. |

### Summary

U5 소스 매니페스트와 구현 전 문서 제외 근거를 확인했고, 합성 복구와 전체 자동 검증이 통과했다. 운영 환경에서는 백업 실패가 길어져도 만료 파일을 기한 안에 제거할 수 있어야 한다.
