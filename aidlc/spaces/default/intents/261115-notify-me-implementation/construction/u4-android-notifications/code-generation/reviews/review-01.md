## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T06:19:34Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > recover (127–137), 호출원 NotifyDevicePlugin.handleOnResume 및 bind | 앱이 다시 열리면 저장된 계획을 먼저 조정하고 그 뒤 현재 인가된 FULL을 요청한다. 중지 중에 담당 해제·보관·가구 회수가 일어났고 기기가 변경 신호를 놓친 경우, 앱을 다시 연 시점에 지난 계획의 비공개 제목을 표시하거나 이전 지오펜스를 등록한 다음에야 서버의 제거를 확인한다. 강제 종료 후 재실행의 FULL 우선 동작과 어긋난다. | 재실행 경로에서는 최신 FULL이나 명시적 회수 처리를 완료한 뒤 계획을 적용한다. 부팅에서 필요한 오프라인 예약 복구는 별도 경로로 두고 권한을 확인한 재실행과 구분한다. 오래된 예정 알림과 회수 응답이 있는 재실행에서 오래된 계획이 먼저 적용되지 않는지 시험한다. | New |
| R-02 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (237–251) 및 fired (258–268) | 위치 권한 또는 위치 서비스가 꺼져 지오펜스를 제거해도 마지막 경계와 진행 중인 타이머는 지우지 않는다. 같은 부팅의 `recoverTimer`는 연속성 인수와 무관하게 기존 타이머를 반환하므로, 감지 중단 중에 놓친 이탈·재진입이 있어도 권한 복구 뒤 이전 타이머를 다시 예약해 알림을 표시할 수 있다. | 감지 중단을 확인하면 마지막 위치 경계와 진행 중인 타이머를 무효화하고 OS 타이머를 취소한다. 복구에서 초기 상태 관측과 실제 전이를 구분하고, 중단 전 타이머 만료와 복구 뒤 새 전이를 각각 검증한다. | New |
| R-03 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt > reconcile (220–253), DeviceNotifications.removeFences 및 addFences | 장소 계획의 제거·등록에 대한 Google Play 서비스 호출을 기다린 뒤에만 TIME 계획을 예약한다. 장소 호출이 타임아웃 또는 오류를 돌려주면 전체 조정이 중단된다. 같은 장소 작업이 반복 실패하는 동안 해당 설치의 유효한 TIME 알림도 신규 예약이나 재부팅 후 복구되지 않는다. | 제거 대상의 논리적 무효화와 이전 세대 격리를 유지하면서, 현재 세대에서 TIME 예약을 장소 등록·일시 실패와 독립적으로 적용한다. 장소 재시도는 별도 상태로 남기고 장소 등록 실패 중에도 같은 범위에서 새 TIME 예약이 적용되는지 검증한다. | New |
| R-04 | Major | src/server/installations.ts > recordEvent (256–277), src/server/installation-input.ts > locationEventInput 및 android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleRules.kt > event | 위치 이벤트 업로드에는 epoch가 없고 서버는 현재 계획 버전만 비교한다. 또한 이벤트 ID는 회차·버전·전이 번호·조건으로 계산한다. 복구 generation만 교체된 동일 범위에서는 새 전이가 이전 보존 이벤트와 같은 키를 사용할 수 있어 충돌하고, 이전 세대 이벤트를 현재 계획과 구분할 수 없다. | 이벤트 전송·검증에 현재 설치 범위의 epoch를 포함하고 저장·작업 키와 기기 이벤트 ID에 세대 경계를 적용한다. 같은 회차와 계획 버전이 남은 복구에서 이전 세대 이벤트는 거절하고 새 세대 이벤트는 독립적으로 기록하는지 검증한다. | New |

### Validation Tool Results

같은 검토의 재발급 요청에서 현재 매니페스트 소스 98개의 해시가 이전 검토 및 CI 후보와 일치함을 확인했다. 아래 명령 결과는 동일 소스에 대한 직전 검토에서 직접 확인한 결과다.

| Tool | Result | Interpretation |
|---|---|---|
| `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf" LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu" PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright" npm run verify:u1` | PASS, 종료 코드 0. 타입 검사·프로덕션 빌드·Vitest 및 Chromium 4건, 라인 86.33% | 기존 웹 흐름과 합성 Android 브리지 경로는 통과했다. 실제 Android 생명주기·센서 실행 순서는 이 테스트에 포함되지 않는다. |
| `npm exec -- vitest run tests/u4/` | PASS, 5개 파일 16건 | 설치 저장소·HTTP·규칙·웹의 기존 사례가 통과했다. 세대가 바뀌고 계획 버전이 유지되는 이벤트 쓰기는 현재 입출력 경계에 포함되지 않는다. |
| `npm exec -- playwright test tests/e2e/u4/` | PASS, 1건. 전체 검증과 동일한 로컬 Chromium 설정 사용 | 좁은 터치 화면에서 이 기기의 장소 제외를 조정해도 작성 중인 업무 초안이 보존된다. |
| `./android/gradlew -p android/schedule-core test` | PASS, 지정된 로컬 ARM64 JDK 사용. 해당 작업 최신 상태이고 JUnit XML은 8건, 실패 0건 | JVM 규칙 검증은 기존 결과와 일치한다. 위치 권한의 같은 부팅 중단과 복구 경로, 앱 단위의 OS 호출 실패 격리는 확인하지 않는다. |
| `./android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` | x64 Android CI 성공을 확인했다. 로컬에는 Android SDK가 없어 재실행하지 않았다. | [Android CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44643257534)는 합성 API 원점으로 APK를 조립했다. Google 로그인, FCM과 두 실기기의 센서·재부팅·잠금 화면, 대상 Pi 측정은 남아 있다. |
| 로컬 소스의 Git blob 비교 | PASS, 매니페스트 98개 파일이 `f443eaf`와 일치 | Android와 애플리케이션 CI의 소스가 검토한 소스와 일치한다. [애플리케이션 CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/44643257503)도 성공했다. |

### Summary

기존 검증은 통과했지만 앱 재실행의 인가 순서, 위치 감지 연속성, 장소 기능 실패 시 시간 예약 격리, 복구 세대의 위치 이벤트 구분에 구현 보완이 필요하다.
