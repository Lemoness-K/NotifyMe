## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T06:35:10Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > recover (127–137), 호출원 NotifyDevicePlugin.handleOnResume 및 bind | 앱이 다시 열리면 저장된 계획을 먼저 조정하고 그 뒤 현재 인가된 FULL을 요청한다. 중지 중에 담당 해제·보관·가구 회수가 일어났고 기기가 변경 신호를 놓친 경우, 앱을 다시 연 시점에 지난 계획의 비공개 제목을 표시하거나 이전 지오펜스를 등록한 다음에야 서버의 제거를 확인한다. 강제 종료 후 재실행의 FULL 우선 동작과 어긋난다. | 재실행 경로에서는 최신 FULL이나 명시적 회수 처리를 완료한 뒤 계획을 적용한다. 부팅에서 필요한 오프라인 예약 복구는 별도 경로로 두고 권한을 확인한 재실행과 구분한다. 오래된 예정 알림과 회수 응답이 있는 재실행에서 오래된 계획이 먼저 적용되지 않는지 시험한다. | Resolved (reviewer) |
| R-02 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (237–251) 및 fired (258–268) | 위치 권한 또는 위치 서비스가 꺼져 지오펜스를 제거해도 마지막 경계와 진행 중인 타이머는 지우지 않는다. 같은 부팅의 `recoverTimer`는 연속성 인수와 무관하게 기존 타이머를 반환하므로, 감지 중단 중에 놓친 이탈·재진입이 있어도 권한 복구 뒤 이전 타이머를 다시 예약해 알림을 표시할 수 있다. | 감지 중단을 확인하면 마지막 위치 경계와 진행 중인 타이머를 무효화하고 OS 타이머를 취소한다. 복구에서 초기 상태 관측과 실제 전이를 구분하고, 중단 전 타이머 만료와 복구 뒤 새 전이를 각각 검증한다. | Unresolved |
| R-03 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (220–253), DeviceNotifications.removeFences 및 addFences | 장소 계획의 제거·등록에 대한 Google Play 서비스 호출을 기다린 뒤에만 TIME 계획을 예약한다. 장소 호출이 타임아웃 또는 오류를 돌려주면 전체 조정이 중단된다. 같은 장소 작업이 반복 실패하는 동안 해당 설치의 유효한 TIME 알림도 신규 예약이나 재부팅 후 복구되지 않는다. | 제거 대상의 논리적 무효화와 이전 세대 격리를 유지하면서, 현재 세대에서 TIME 예약을 장소 등록·일시 실패와 독립적으로 적용한다. 장소 재시도는 별도 상태로 남기고 장소 등록 실패 중에도 같은 범위에서 새 TIME 예약이 적용되는지 검증한다. | Resolved (reviewer) |
| R-04 | Major | src/server/installations.ts > recordEvent (256–277), src/server/installation-input.ts > locationEventInput 및 android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleRules.kt > event | 위치 이벤트 업로드에는 epoch가 없고 서버는 현재 계획 버전만 비교한다. 또한 이벤트 ID는 회차·버전·전이 번호·조건으로 계산한다. 복구 generation만 교체된 동일 범위에서는 새 전이가 이전 보존 이벤트와 같은 키를 사용할 수 있어 충돌하고, 이전 세대 이벤트를 현재 계획과 구분할 수 없다. | 이벤트 전송·검증에 현재 설치 범위의 epoch를 포함하고 저장·작업 키와 기기 이벤트 ID에 세대 경계를 적용한다. 같은 회차와 계획 버전이 남은 복구에서 이전 세대 이벤트는 거절하고 새 세대 이벤트는 독립적으로 기록하는지 검증한다. | Resolved (reviewer) |
| R-05 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > monitoringContinuous 및 checkMonitoring (340–347), fired 및 boundary (350–383) | 일반적인 메모리 회수로 앱 프로세스만 재생성돼도 매번 새 `processId`를 만들어 이전 위치 경계와 타이머를 무효화한다. Google Play 서비스는 앱과 다른 프로세스에서 지오펜스를 보관한다. 따라서 같은 부팅에 권한과 기존 등록이 유지된 중에도, 실제 진입·이탈 인텐트나 저장한 타이머가 앱을 깨우면 그 첫 콜백을 폐기한다. `docs/04-notification-and-scheduling.md` 136행의 프로세스 재생성 후 타이머 복구와 배치된다. [Android 지오펜스 재등록 지침](https://developer.android.com/develop/sensors-and-location/location/geofencing#reRegister) | 동일 부팅의 정상적인 프로세스 재생성과 실제 감지 중단을 구분한다. 등록 세대·권한·부팅을 확인할 수 있는 정상 콜백과 저장 타이머 경로를 복원하고, 확인할 수 없는 경우에만 새 기준을 수립한다. 기존 등록이 유지된 프로세스 재생성 뒤 첫 실제 전이 및 타이머의 만료를 각각 검증한다. | New |
| R-06 | Major | android/app/src/main/java/app/notifyme/client/NotifyDevicePlugin.kt > handleOnResume (195–199), DeviceSchedule.refresh (106–149) 및 fired (350–363) | 같은 앱 프로세스에서 앱 간 전환 후 돌아와도 항상 새 FULL 확인을 요구한다. 그때 서버가 일시적으로 닿지 않으면 `awaitingFull`이 남고, 이후 OS가 전달한 이미 인가·예약된 TIME 알람이나 정상 LOCATION 콜백도 처리 없이 반환된다. 짧은 일반 복귀가 기존 오프라인 알림을 서버 연결이 돌아올 때까지 중단시킨다. | 강제 종료 뒤 재실행과 일반 foreground 복귀의 동기화 정책을 구분한다. 일반 복귀의 일시 조회 실패는 기존 인가 범위의 유효한 로컬 알림을 중단시키지 않으며, 명시적 회수와 확인이 필요한 범위 변경에서는 계속 차단한다. 기존 예약이 있는 상태에서 오프라인 복귀와 회수 후 복귀를 각각 검증한다. | New |

> R-01 Reviewer note: `DeviceSchedule.recover`는 foreground에서 캐시를 적용하기 전에 인가된 FULL을 가져온다. `refresh`는 진행 중에 foreground 요청이 바뀌면 이전 응답을 버리고, 회수 응답을 별도로 처리한다. 부팅의 캐시 복원은 TIME으로 구분했다. 일반 복귀까지 일괄 차단하는 새 문제는 아래에 따로 기록했다.

> R-02 Reviewer note: `ScheduleReceiver` 31, 51–56, 107–109행은 위치 서비스 OFF를 이미 대기 중인 타이머 뒤에 넣는다. 타이머가 대기하는 동안 OFF 뒤 ON이 오면, 먼저 실행되는 이전 타이머는 `DeviceSchedule.checkMonitoring`에서 현재 권한과 같은 boot/process를 확인하고 이전 연속성을 인정한다. 34행에서는 재등록이 필요한 `GEOFENCE_NOT_AVAILABLE`도 버린다. OFF나 감지 불가 수신 즉시 기존 감지 세대를 무효화하고 대기 중 콜백이 그 상태를 확인하게 한다. OFF·ON 사이에 대기하던 만료와 감지 불가 후 재등록을 검증한다. [Android 지오펜스 재등록 지침](https://developer.android.com/develop/sensors-and-location/location/geofencing#reRegister)

> R-03 Reviewer note: `applyIndependentSchedules`가 TIME을 먼저 등록한다. 장소 예외는 재시도 작업으로 남긴다. 이전 범위는 먼저 비활성화하고 알람·알림과 이전 지오펜스의 전달 인텐트를 취소한다. 새 지오펜스는 남은 OS 등록 제거를 마친 뒤에 등록한다.

> R-04 Reviewer note: 기기에서 이벤트 ID와 요청에 epoch를 포함한다. 서버가 이전 epoch를 거절하고, 이벤트 저장과 멱등 키를 현재 epoch에 묶는다. 같은 계획 버전과 이벤트 ID가 남아 있어도 새 epoch에서 독립적으로 기록된다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS, 종료 코드 0. 타입 검사·빌드, Vitest 178건, Chromium 4건 및 라인 86.34% | 전체 회귀와 커버리지 기준을 통과했다. Android 위치 전이·정상 프로세스 재생성 순서는 이 검증에 포함되지 않는다. |
| `npm exec -- vitest run tests/u4/` | PASS, 5개 파일 17건 | 서버와 공유 웹을 검증했다. 예전 epoch의 위치 이벤트를 거절하고 새 epoch에서 독립적으로 기록하는 회귀 사례를 포함한다. |
| `npm exec -- playwright test tests/e2e/u4/` | PASS, 1건. 전체 검증과 동일한 로컬 Chromium 설정 사용 | 좁은 화면에서 설치별 장소 제외를 조정하며 리마인더 초안을 보존하는 흐름을 검증했다. |
| `./android/gradlew -p android/schedule-core test` | 기존 로컬 XML 12건, 실패 0건. 최종 후보 Android CI JVM 단계 성공 | 로컬 Gradle 프로세스가 검토 스냅샷을 바꾸므로 다시 실행하지 않았다. JVM 범위는 인가 확인과 장소 중단·실패 격리, epoch별 이벤트 키를 포함한다. |
| `./android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` | 최종 정확한 후보의 x64 Android CI 성공 | 로컬 Android SDK 없이 동일 후보의 [Android CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44688728938)에서 앱 단위 테스트와 합성 구성 APK 조립을 확인했다. 실제 두 기기·Google 로그인·FCM 및 대상 Pi는 미검증이다. |
| 로컬 소스의 Git blob 비교 | PASS, 매니페스트 소스 98개 및 공유 계약 파일이 `6d71784`와 일치 | 검토한 파일이 Android CI의 후보와 일치한다. |

### Summary

이전 지적 네 건 중 세 건은 해소됐다. 위치 서비스가 다시 켜질 때의 콜백 순서, 정상 프로세스 재생성 뒤의 위치 알림, 오프라인 일반 복귀 뒤의 기존 예약을 보완해야 한다.
