## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T17:10:39Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/delete-journal.ts > DeleteJournal.open 및 initializeAuthority (57–73, 99–104행), src/server/operations/activation.ts > Activation.start | 기동은 활성 DB의 epoch를 확인하고 DB에 있는 최근 커밋 증거를 원장에서 찾는다. 권위 원장의 확정 삭제가 선택한 DB에도 반영됐는지는 역방향으로 검사하지 않는다. 같은 운영 세대의 오래된 DB는 `OperationsGeneration`을 그대로 포함하므로 현재의 완전한 원장과 짝을 이뤄도 이미 삭제한 업무가 있는 상태로 기동할 수 있다. 최초 도입에서도 기존 원장 끝을 바닥으로 채택하기 전에 그 원장의 확정 삭제가 DB에 반영됐는지 확인하지 않는다. 격리 복원으로 만든 `VERIFIED` 기록의 종료 위치도 최초 기동 직전의 권위 증거와 대조하지 않는다. | 공용 리스너와 Worker 시작 전, 초기 기준점 편입 및 복원 최초 기동에서 권위 있는 삭제 효과와 선택된 DB의 커밋 증거·대상 부재를 양방향으로 대조한다. 검증된 후보의 계보·종료 위치·인증값을 활성화 기록에 묶어 최신 원장 경계를 다시 검사한다. 정리된 위치 이전의 효과도 선택된 DB와 연결한 신뢰 증거로 확인한다. 오래된 동일 epoch DB, DB와 일치하지 않는 기존 원장, 검증 뒤 최신점 변경에서 리스너와 Worker가 열리지 않음을 확인한다. | Resolved (reviewer) |
| R-02 | Major | src/server/operations/restore.ts > applyDeletes (33–65행) 및 src/server/auth.ts > SessionService.principal 및 end (116–138행) | 백업에 저장된 `Session`은 옛 DB에서 그대로 활성화된다. 백업 뒤 로그아웃한 세션의 종료 시각이 옛 사본에는 없고, 새 설치 epoch는 서버 세션을 검증하는 데 사용되지 않는다. 복원이 과거 앱 세션의 권한을 되살릴 수 있다. | 공개 전 복원 DB의 기존 앱 세션을 만료 또는 무효화해 재인증을 요구한다. 백업 뒤 로그아웃한 세션이 옛 사본을 복원한 뒤에도 거절되는지 합성 계정으로 검증한다. 복원된 가구 접근 정책을 운영 검증에서 확인한다. | Resolved (reviewer) |
| R-03 | Major | src/server/operations/restore.ts > restoreBackup (75–102행), src/server/operations/backup.ts > select 및 valid (93–100행) | 백업 연령은 복원 초기에 전달받은 시각으로 한 번 확인한다. 사본 복호화·재적용·검증 중 30일 시점이 지나거나 검증 뒤 기동이 늦어진 경우에도 활성화 경로는 사본 만료를 확인하지 않는다. D-058의 만료 후보 공개 차단을 보장하지 못한다. | 30일 경계를 활성화 증거에 묶고 긴 복구의 최종 검증과 최초 공개 시작 직전에도 확인한다. 복구 시작에는 유효했지만 최초 공개 시점에는 만료된 사본을 차단하는 검증을 추가한다. | Resolved (reviewer) |
| R-04 | Minor | src/server/operations/reporting.ts > OperationsReporter.observe (21–50행) | 주간 요약만 켜면 장애 전이를 집계하는 분기가 별도 장애 기록 스위치에 묶여 있어 장애 횟수가 항상 0이다. 두 설정을 독립 활성화할 수 있지만 보고서 값이 로컬 관측을 반영하지 않는다. | 주간 요약에 필요한 상태·횟수 계산과 별도 장애 이벤트 출력을 분리한다. 주간 요약만 켠 경우에도 관측한 장애를 집계하며 별도 장애 기록은 출력하지 않는지 확인한다. | Resolved (reviewer) |

> R-01 Reviewer note: `DeleteJournal.open`·`assertDatabase`가 현재 원장의 확정 증거와 선택한 DB의 커밋·대상 부재를 양방향 대조한다. 정리된 커밋 집합은 독립 권위 레코드의 `floorProof`에 인증한다. 최초 도입도 기존 보존 범위와 검증된 DB를 대조한다. 복원 시 `VERIFIED`가 후보 해시·epoch·계보·인증 위치를 묶고, 마지막 권위 값 일치를 확인할 때까지 HTTP 데이터 응답과 Worker를 차단한다. 같은 epoch의 오래된 DB와 정리 이후의 오래된 DB, 검증 뒤 권위 경계 변경을 따로 검증했다.

> R-02 Reviewer note: `prepareCandidate`에서 기존 세션·로그인 챌린지와 세션에 묶인 설치 토큰을 격리된 DB 안에서 무효화한다. 인증 없이 옛 사본의 세션으로 돌아갈 수 없고 설치의 푸시 자격도 재등록이 필요하다. 실제 SQLite 사본을 복원하는 회귀에 기존 로컬 세션 거절이 포함된다.

> R-03 Reviewer note: 사본의 인증된 생성시각에서 만료를 계산한다. 복호화·삭제 재적용 뒤 및 최초 공개 직전에 다시 검사한다. `ACTIVE` 승격은 마지막 검사 뒤에만 이뤄지며 쓰기·재시작 중 만료 및 승격 중단을 검증한다.

> R-04 Reviewer note: 별도 장애 기록 설정과 전이 집계가 분리됐다. 주간 보고만 켠 경우의 집계 및 별도 장애 로그 미출력도 시험한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS. Vitest 211건, 줄 커버리지 87.26%, Playwright 4건, 종료 코드 0. | 승인된 타입 검사·빌드·커버리지·브라우저를 재실행했다. |
| `npm exec -- vitest run tests/u5/` | PASS. 파일 5개, 33건. | 이전 동일 epoch, 인증 바닥까지 정리된 경우, 복원 세션, 만료, 공개 및 운영 기록 경계를 대조했다. |
| `npm exec -- vitest run tests/u3/http.test.ts` | PASS. 파일 1개, 10건. | U3 리마인더 API와 기존 삭제 통합 검증을 실행했다. |
| 소스 매니페스트 Git blob과 후보 CI 대조 | PASS. 33개 경로가 모두 `357774d`와 일치하고 CI도 성공 | 합성 자료의 SQLite·로컬 운영 검증이다. 실제 Pi의 매체와 키 설치, 현장 환경의 백업·복구 전환 및 DS-014 부하는 미검증이다. [애플리케이션 CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44780195844) |

### Summary

기동 및 복원에서 오래된 삭제·세션을 다시 공개하지 않는 경계와 최초 공개 직전 만료 검사를 확인했다. 주간 보고만 선택했을 때도 실제로 관측한 장애가 요약에 포함된다.
