# ADR-018: Android force-stop 중 알림 제한과 재실행 복구

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-004`, `D-005`, `D-008`, `D-046`, `D-050`
- 관련 요구사항: `PR-AC-005`, `PR-AC-008`, `PR-AC-041`

## 맥락

앱이 화면에 보이지 않는 background 상태와 사용자가 Android 설정에서 직접 `강제 종료(Force stop)`한 상태는
다르다. Force-stop은 OS가 앱을 stopped 상태로 묶어 두며, 사용자가 앱을 다시 열기 전까지 앱의 alarm,
geofence callback, FCM ChangeSignal을 통한 동기화를 보장할 수 없다. Android 15에서는 앱이 stopped 상태가
될 때 pending intent도 취소된다. FCM도 Android에서 사용자가 설정으로 force-quit한 앱을 수신 상태로 되돌리려면
사용자가 직접 앱을 다시 열어야 한다.

## 결정

- Notify Me는 Android force-stop 상태를 우회하거나 앱을 자동 실행하지 않는다.
- force-stop 상태 동안 시간 알림, 장소 알림, FCM ChangeSignal 수신을 보장하지 않는다. 앱의 설정·도움말에
  이 제한과 앱을 직접 다시 열어야 알림이 복구된다는 안내를 제공한다.
- 사용자가 앱을 직접 다시 열면 먼저 인증된 서버 full sync를 하고, 최신 Reminder·Occurrence 상태로 해당
  설치의 시간 알람과 geofence를 reconcile한다. 완료·취소·놓침·건너뛴 회차와 보관 상태는 기존 규칙에 따라 예약을 제거하고,
  시간 알림의 24시간 catch-up cutoff는 `D-048`을 적용한다.
- force-stop 동안 예약을 다시 세우거나 업무 상태를 바꾸지 않는다. 서버가 최신 업무 상태의 기준이다.

## 결과

- 사용자가 force-stop한 동안의 background 알림 누락을 제품 오류로 오인하지 않도록 한계와 복구 방법을
  설정·도움말에 설명한다.
- 앱이 다시 열리면 missed signal 횟수와 관계없이 현재 revision을 기준으로 수렴한다. 예정 시각부터 24시간이
  지난 로컬 알람은 `D-048`에 따라 표시하지 않고 기존 할 일 상태만 유지한다.
- Android 버전 및 제조사별 background 제한은 구현 시 실기기 검증 대상이며, 이 설계는 강제 종료 중 전달
  SLA를 약속하지 않는다.

## 공식 근거

- [Android 15 behavior changes: package stopped state](https://developer.android.com/about/versions/15/behavior-changes-all): Force-stop 뒤 stopped 상태와 pending intent 취소 동작.
- [Firebase: Receive messages in Flutter apps](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages): Android에서 설정으로 force-quit한 앱은 사용자가 직접 다시 열어야 FCM 메시지 수신을 재개함.
