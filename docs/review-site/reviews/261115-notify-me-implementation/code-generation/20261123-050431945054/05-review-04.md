---
layout: review
title: "Review 04"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/code-generation/reviews/review-04.md"
permalink: "/reviews/261115-notify-me-implementation/code-generation/20261123-050431945054/05-review-04/"
---

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T15:23:17Z
**Iteration:** 2
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
| R-07 | Major | android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt:502 > `drain`의 업로드 성공 경로 | D-043은 서버가 동기화를 확인하면 기기에서 해당 장소 이벤트 저널 항목을 삭제하도록 한다. 현재는 `uploaded=true`를 저장해 전체 이벤트를 유지한다. 계획이 바뀌거나 이후 동기화에서 30일 경과 항목을 정리할 때까지 감지 시각과 조건 메타데이터가 남을 수 있다. | 서버 확인 후 업로드 대기 저널에서 이벤트 본문을 제거한다. 미완료 게시의 재시도나 기존 OS 알림의 취소에 필요한 식별자는 용도에 맞게 최소한으로 보존하고, 서버 확인 후 앱 재시작에서 중복 게시 없이 저널이 정리되는지 검증한다. | New |
| R-08 | Minor | tests/u4/storage-model.test.ts:11 > 이전 SQLite 스키마 준비 | 개발 전체 실행 두 건에서 이 준비 단계가 90초를 넘겼다. 작업자를 2개로 제한한 개발 진단과 이 독립 기본 실행은 통과했다. 전체 검증의 재현성이 실행 환경 부하에 민감하다. | 같은 실패가 반복되면 이전 스키마 적용에 걸린 시간과 병렬 실행 수를 함께 기록하고, 실제 순방향 마이그레이션 검증을 유지하면서 재현 가능한 실행 조건을 정한다. | New |
| R-09 | Minor | android/app/build.gradle > Android 앱 단위 테스트 및 APK 조립 | 로컬 ARM64 환경에서 Android SDK 경로와 플랫폼 설치를 확인할 수 없어 앱 SDK 명령을 새로 실행하지 못했다. `2035730`의 x64 Android CI는 앱 단위 테스트와 디버그 APK 조립을 통과했으며 현재 Android 소스·CI 설정은 그 커밋과 일치한다. | 앱 SDK나 관련 소스가 변경되면 x64 CI에서 해당 후보를 다시 확인하고, 실제 Android 권한·재부팅·잠금 화면·FCM·지오펜스 동작은 실기기 인수 검증에 남긴다. | New |

### Validation Tool Results

U4 검토 산출물과 Unit 소스의 지문이 두 요청에서 일치한다. 이번 요청에서 계획, 매니페스트, 추적표와 지적 사항의 코드 경로를 다시 대조했다. 아래 실행 결과는 2026-11-22 15:13–15:22 UTC에 이 리뷰어가 실행한 기록이며 새 요청에 연결했다. 이번 요청에서는 바이너리와 테스트를 다시 생성하지 않았다.

| 검사 | 결과 | 확인 범위 |
|---|---|---|
| `npm exec -- vitest run tests/u4/` | 종료 코드 0. 5개 파일, 17개 통과 | 이전 스키마 마이그레이션, 설치별 수용 한도, 인증·동기화, FCM 대역 및 공유 웹 |
| 프로젝트 ARM64 JDK 21 및 로컬 Gradle 캐시의 `./android/gradlew -p android/schedule-core test --no-daemon --offline --rerun-tasks` | 종료 코드 0. 컴파일 및 테스트 작업을 새로 실행했다. 테스트 결과 XML 3개에 16개 통과가 기록됐다. | 순수 Kotlin 예약·위치 중단·프로세스 시작 및 상태 규칙 |
| 승인된 `npm run verify:u1` 및 기록된 로컬 Chromium·글꼴 환경 | 종료 코드 0. 타입 검사와 빌드, Vitest 32개 파일·211개, 라인 커버리지 87.26%, Playwright 4개 통과 | 기본 명령으로 실행했고 작업자 수를 추가 지정하지 않았다. U4 Chromium은 614ms에 통과했다. 이전 마이그레이션 준비 시간 초과는 재현되지 않았다. |
| Android SDK 앱 단위 테스트와 APK 조립 | 이번 로컬 실행은 SDK 부재로 미실행. `2035730`의 GitHub Actions 44900053693 성공 기록과 현재 Android 소스·CI 설정 일치를 확인했다. | 과거 x64 SDK 증거. 실제 기기의 OS 동작은 미검증이다. |
| Git 변경 이력과 추적표 대조 | `5bf6785`의 AI-DLC 기록 외 경로 103개와 매니페스트 103개가 일치한다. 추적표 104개 ID가 중복 없이 대응한다. | D-097·Q-069의 U4 변경이 알림·스케줄링 설계와 결정 등록부에 연결된다. |

### Summary

U4의 문서 변경 귀속과 Android 알림 구현 경로를 확인했고 동일 U4 소스에서 앞서 실행한 기본 검증이 통과했다. 서버 확인 후 기기의 장소 이벤트 저널을 삭제하는 동작과 실제 Android 기기 인수 검증이 남아 있다.
