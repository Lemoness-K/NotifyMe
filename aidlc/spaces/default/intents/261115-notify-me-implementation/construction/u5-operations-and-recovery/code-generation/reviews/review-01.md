## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T16:49:17Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | src/server/delete-journal.ts > DeleteJournal.open 및 initializeAuthority (57–73, 99–104행), src/server/operations/activation.ts > Activation.start | 기동은 활성 DB의 epoch를 확인하고 DB에 있는 최근 커밋 증거를 원장에서 찾는다. 권위 원장의 확정 삭제가 선택한 DB에도 반영됐는지는 역방향으로 검사하지 않는다. 같은 운영 세대의 오래된 DB는 `OperationsGeneration`을 그대로 포함하므로 현재의 완전한 원장과 짝을 이뤄도 이미 삭제한 업무가 있는 상태로 기동할 수 있다. 최초 도입에서도 기존 원장 끝을 바닥으로 채택하기 전에 그 원장의 확정 삭제가 DB에 반영됐는지 확인하지 않는다. 격리 복원으로 만든 `VERIFIED` 기록의 종료 위치도 최초 기동 직전의 권위 증거와 대조하지 않는다. | 공용 리스너와 Worker 시작 전, 초기 기준점 편입 및 복원 최초 기동에서 권위 있는 삭제 효과와 선택된 DB의 커밋 증거·대상 부재를 양방향으로 대조한다. 검증된 후보의 계보·종료 위치·인증값을 활성화 기록에 묶어 최신 원장 경계를 다시 검사한다. 정리된 위치 이전의 효과도 선택된 DB와 연결한 신뢰 증거로 확인한다. 오래된 동일 epoch DB, DB와 일치하지 않는 기존 원장, 검증 뒤 최신점 변경에서 리스너와 Worker가 열리지 않음을 확인한다. | New |
| R-02 | Major | src/server/operations/restore.ts > applyDeletes (33–65행) 및 src/server/auth.ts > SessionService.principal 및 end (116–138행) | 백업에 저장된 `Session`은 옛 DB에서 그대로 활성화된다. 백업 뒤 로그아웃한 세션의 종료 시각이 옛 사본에는 없고, 새 설치 epoch는 서버 세션을 검증하는 데 사용되지 않는다. 복원이 과거 앱 세션의 권한을 되살릴 수 있다. | 공개 전 복원 DB의 기존 앱 세션을 만료 또는 무효화해 재인증을 요구한다. 백업 뒤 로그아웃한 세션이 옛 사본을 복원한 뒤에도 거절되는지 합성 계정으로 검증한다. 복원된 가구 접근 정책을 운영 검증에서 확인한다. | New |
| R-03 | Major | src/server/operations/restore.ts > restoreBackup (75–102행), src/server/operations/backup.ts > select 및 valid (93–100행) | 백업 연령은 복원 초기에 전달받은 시각으로 한 번 확인한다. 사본 복호화·재적용·검증 중 30일 시점이 지나거나 검증 뒤 기동이 늦어진 경우에도 활성화 경로는 사본 만료를 확인하지 않는다. D-058의 만료 후보 공개 차단을 보장하지 못한다. | 30일 경계를 활성화 증거에 묶고 긴 복구의 최종 검증과 최초 공개 시작 직전에도 확인한다. 복구 시작에는 유효했지만 최초 공개 시점에는 만료된 사본을 차단하는 검증을 추가한다. | New |
| R-04 | Minor | src/server/operations/reporting.ts > OperationsReporter.observe (21–50행) | 주간 요약만 켜면 장애 전이를 집계하는 분기가 별도 장애 기록 스위치에 묶여 있어 장애 횟수가 항상 0이다. 두 설정을 독립 활성화할 수 있지만 보고서 값이 로컬 관측을 반영하지 않는다. | 주간 요약에 필요한 상태·횟수 계산과 별도 장애 이벤트 출력을 분리한다. 주간 요약만 켠 경우에도 관측한 장애를 집계하며 별도 장애 기록은 출력하지 않는지 확인한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS. 종료 코드 0, Vitest 201건, Playwright 4건, 라인 87.01%. | 승인된 타입 검사·빌드·전체 앱 회귀를 재실행했다. |
| `npm exec -- vitest run tests/u5/` | PASS. 파일 5개, 23건 | 실제 합성 SQLite WAL의 암호화 사본, 오래된 사본의 삭제 재적용, 잘린 원장, 가용하지 않은 독립 최신점, 암호문 변조·공개 차단과 Caddy 경로를 검증했다. 현재 테스트에는 같은 epoch의 오래된 운영 DB 기동과 옛 앱 세션 무효화가 없다. |
| `npm exec -- vitest run tests/u3/http.test.ts` | PASS. 파일 1개, 10건 | 기존 U3 HTTP 경계를 유지한다. 구현에서 첫 요청의 쓰기 전 가구 회수만 ABORTED에 추가했고 기존 재시도는 구별한다. 설치 정리 실패를 원장 조정과 분리하는 U5 테스트도 통과했다. |
| 소스 매니페스트 Git blob 대조와 CI | PASS. 32개 파일 모두 `206bfe2`와 일치. 동일 후보 CI 성공 | 합성 자격과 테스트 경로만 사용했다. 실제 Pi·운영 키·독립 매체 및 대상 부하 검증은 실행하지 않았다. [애플리케이션 CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44776944602) |

### Summary

암호화 사본, 원장 꼬리 검증과 합성 복구는 작동했다. 같은 세대의 오래된 운영 DB를 권위 원장과 대조하는 기동 조건이 남아 있으며, 복원 뒤 세션과 만료 후보의 공개 조건도 보완해야 한다.
