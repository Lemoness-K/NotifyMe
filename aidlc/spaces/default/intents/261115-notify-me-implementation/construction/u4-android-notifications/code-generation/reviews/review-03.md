## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T13:24:01Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > recover (127–137), 호출원 NotifyDevicePlugin.handleOnResume 및 bind | 앱이 다시 열리면 저장된 계획을 먼저 조정하고 그 뒤 현재 인가된 FULL을 요청한다. 중지 중에 담당 해제·보관·가구 회수가 일어났고 기기가 변경 신호를 놓친 경우, 앱을 다시 연 시점에 지난 계획의 비공개 제목을 표시하거나 이전 지오펜스를 등록한 다음에야 서버의 제거를 확인한다. 강제 종료 후 재실행의 FULL 우선 동작과 어긋난다. | 재실행 경로에서는 최신 FULL이나 명시적 회수 처리를 완료한 뒤 계획을 적용한다. 부팅에서 필요한 오프라인 예약 복구는 별도 경로로 두고 권한을 확인한 재실행과 구분한다. 오래된 예정 알림과 회수 응답이 있는 재실행에서 오래된 계획이 먼저 적용되지 않는지 시험한다. | Resolved (reviewer) |
| R-02 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (237–251) 및 fired (258–268) | 위치 권한 또는 위치 서비스가 꺼져 지오펜스를 제거해도 마지막 경계와 진행 중인 타이머는 지우지 않는다. 같은 부팅의 `recoverTimer`는 연속성 인수와 무관하게 기존 타이머를 반환하므로, 감지 중단 중에 놓친 이탈·재진입이 있어도 권한 복구 뒤 이전 타이머를 다시 예약해 알림을 표시할 수 있다. | 감지 중단을 확인하면 마지막 위치 경계와 진행 중인 타이머를 무효화하고 OS 타이머를 취소한다. 복구에서 초기 상태 관측과 실제 전이를 구분하고, 중단 전 타이머 만료와 복구 뒤 새 전이를 각각 검증한다. | Resolved (reviewer) |
| R-03 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (220–253), DeviceNotifications.removeFences 및 addFences | 장소 계획의 제거·등록에 대한 Google Play 서비스 호출을 기다린 뒤에만 TIME 계획을 예약한다. 장소 호출이 타임아웃 또는 오류를 돌려주면 전체 조정이 중단된다. 같은 장소 작업이 반복 실패하는 동안 해당 설치의 유효한 TIME 알림도 신규 예약이나 재부팅 후 복구되지 않는다. | 제거 대상의 논리적 무효화와 이전 세대 격리를 유지하면서, 현재 세대에서 TIME 예약을 장소 등록·일시 실패와 독립적으로 적용한다. 장소 재시도는 별도 상태로 남기고 장소 등록 실패 중에도 같은 범위에서 새 TIME 예약이 적용되는지 검증한다. | Resolved (reviewer) |
| R-04 | Major | src/server/installations.ts > recordEvent (256–277), src/server/installation-input.ts > locationEventInput 및 android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleRules.kt > event | 위치 이벤트 업로드에는 epoch가 없고 서버는 현재 계획 버전만 비교한다. 또한 이벤트 ID는 회차·버전·전이 번호·조건으로 계산한다. 복구 generation만 교체된 동일 범위에서는 새 전이가 이전 보존 이벤트와 같은 키를 사용할 수 있어 충돌하고, 이전 세대 이벤트를 현재 계획과 구분할 수 없다. | 이벤트 전송·검증에 현재 설치 범위의 epoch를 포함하고 저장·작업 키와 기기 이벤트 ID에 세대 경계를 적용한다. 같은 회차와 계획 버전이 남은 복구에서 이전 세대 이벤트는 거절하고 새 세대 이벤트는 독립적으로 기록하는지 검증한다. | Resolved (reviewer) |
| R-05 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > monitoringContinuous 및 checkMonitoring (340–347), fired 및 boundary (350–383) | 일반적인 메모리 회수로 앱 프로세스만 재생성돼도 매번 새 `processId`를 만들어 이전 위치 경계와 타이머를 무효화한다. Google Play 서비스는 앱과 다른 프로세스에서 지오펜스를 보관한다. 따라서 같은 부팅에 권한과 기존 등록이 유지된 중에도, 실제 진입·이탈 인텐트나 저장한 타이머가 앱을 깨우면 그 첫 콜백을 폐기한다. `docs/04-notification-and-scheduling.md` 136행의 프로세스 재생성 후 타이머 복구와 배치된다. [Android 지오펜스 재등록 지침](https://developer.android.com/develop/sensors-and-location/location/geofencing#reRegister) | 동일 부팅의 정상적인 프로세스 재생성과 실제 감지 중단을 구분한다. 등록 세대·권한·부팅을 확인할 수 있는 정상 콜백과 저장 타이머 경로를 복원하고, 확인할 수 없는 경우에만 새 기준을 수립한다. 기존 등록이 유지된 프로세스 재생성 뒤 첫 실제 전이 및 타이머의 만료를 각각 검증한다. | Resolved (reviewer) |
| R-06 | Major | android/app/src/main/java/app/notifyme/client/NotifyDevicePlugin.kt > handleOnResume (195–199), DeviceSchedule.refresh (106–149) 및 fired (350–363) | 같은 앱 프로세스에서 앱 간 전환 후 돌아와도 항상 새 FULL 확인을 요구한다. 그때 서버가 일시적으로 닿지 않으면 `awaitingFull`이 남고, 이후 OS가 전달한 이미 인가·예약된 TIME 알람이나 정상 LOCATION 콜백도 처리 없이 반환된다. 짧은 일반 복귀가 기존 오프라인 알림을 서버 연결이 돌아올 때까지 중단시킨다. | 강제 종료 뒤 재실행과 일반 foreground 복귀의 동기화 정책을 구분한다. 일반 복귀의 일시 조회 실패는 기존 인가 범위의 유효한 로컬 알림을 중단시키지 않으며, 명시적 회수와 확인이 필요한 범위 변경에서는 계속 차단한다. 기존 예약이 있는 상태에서 오프라인 복귀와 회수 후 복귀를 각각 검증한다. | Resolved (reviewer) |

> R-02 Reviewer note: `ScheduleReceiver`가 위치 OFF와 `GEOFENCE_NOT_AVAILABLE` 수신에서 작업을 큐에 넣기 전 보호 저장소의 감지 버전을 올린다. 이미 대기 중인 콜백은 `LocationRegistration`과 `ScheduleSafety.admitLocation`에서 이전 등록 버전으로 거절된다. 재등록은 기존 타이머를 정리하고 초기 관측을 기준 상태로 사용한다. TIME 실행은 위치 버전과 독립적이다.

> R-05 Reviewer note: `DeviceSchedule.currentRegistration`이 저장된 부팅·등록 버전과, 현재 계획에서 조회한 등록 ID 및 권한을 확인한다. 동일 부팅에서 PID가 달라져도 실제 위치 전이와 저장된 타이머를 처리하며, 권한이나 등록이 바뀐 콜백은 폐기한다. JVM 검증은 저장 상태를 다시 열어 두 경로를 대조한다.

> R-06 Reviewer note: 화면 진입 시 API 35 시작 기록과 최초 foreground 여부로 인가 차단을 결정한다. 일반 재진입은 이미 인가된 기존 TIME·LOCATION을 유지하며 새 FULL을 시도한다. 확인된 강제 종료와 증거가 없는 최초 화면 진입은 당시 인가 버전과 맞는 FULL을 저장한 뒤 해제한다. 실제 부팅은 부팅 ID의 변경을 요구하며 재전달만으로 기존 예약을 적용하지 않는다. 회수 신호는 새 버전을 기록해 진행 중이던 응답의 인가를 무효화한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS. 종료 코드 0, Vitest 178건, Playwright 4건, 라인 커버리지 86.34%. | 타입 검사, 제품 빌드, 전체 회귀를 재실행했다. |
| `npm exec -- vitest run tests/u4/` | PASS. 5개 파일 17건. | 설치·동기화·API와 합성 FCM·UI를 확인했다. |
| `npm exec -- playwright test tests/e2e/u4/` | PASS. Chromium 1건. 전체 검증과 같은 로컬 브라우저 구성을 사용했다. | 좁은 터치 화면에서 설치별 제외와 폼 초안이 유지된다. 네이티브 OS 대신 합성 브리지를 사용한다. |
| `./android/gradlew -p android/schedule-core test` | ARM64 기존 XML 16건, 실패 0건. 같은 후보의 x64 JVM 단계 성공 | 실행기 로그가 검토 스냅샷에 포함되므로 로컬에서는 별도 실행하지 않았다. 네 가지 새 JVM 검증은 위치 무효화, 정상 프로세스 재생성, 일반 오프라인 복귀, 강제 종료·재인가 경계의 규칙을 다룬다. |
| `./android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` | 같은 후보의 x64 앱 단위 테스트와 디버그 APK 조립 성공 | 로컬은 Android SDK가 없다. 실제 OS의 강제 종료·프로세스 회수·대기 작업 순서, 위치·잠금 화면·Doze 및 Firebase 로그인·FCM은 승인된 테스트 구성의 두 실기기 검증으로 남긴다. [Android CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44743190812) |
| 로컬 소스의 Git blob 비교 | PASS. 매니페스트 소스 101개와 공유 계약 1개가 `c48b80c`와 일치 | 독립 검토의 소스와 두 CI 실행의 소스가 일치한다. [애플리케이션 CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44743436509) |

### Summary

코드 변경과 자동화 검증에서 앞선 세 지적을 해소했다. 실제 Android 버전별 시작·위치 동작과 공급자 연동은 실기기 인수 검증에서 확인한다.
