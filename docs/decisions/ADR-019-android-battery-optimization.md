# ADR-019: Android 배터리 최적화 예외를 직접 요청하지 않음

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-044`, `D-047`, `D-050`, `D-051`
- 관련 요구사항: `PR-AC-038`, `PR-AC-042`

## 맥락

Android Doze와 제조사별 절전 정책은 백그라운드 작업과 위치 감지 시점에 영향을 줄 수 있다. Notify Me는
정확 알람 접근과 백그라운드 위치 권한을 각각 설치별 capability로 처리하며, Android 배터리 최적화 예외는
이 권한들과 다른 OS 정책이다. 예외를 요청해도 모든 제조사별 제한이나 force-stop 상태가 해소되는 것은 아니다.

## 결정

- Notify Me는 `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`를 실행하거나 배터리 최적화 예외를 직접 요청하지 않는다.
- 설정은 OS에서 확인 가능한 알림 권한·채널, 정확 알람 접근, 위치 권한·서비스 및 예약 상태를 설치별로 보여준다.
- 필요한 경우 사용자가 선택해 OS 배터리 설정을 확인할 수 있는 안내나 일반 설정 화면 바로가기를 제공한다. 앱이 사용자 동의 없이 OS 설정을 바꾸지 않는다.
- OS가 제공하지 않는 제조사별 제한 상태를 앱이 확실히 판정한다고 표현하지 않는다. 주요 제조사·Android 버전별 동작은 구현 시 실기기에서 검증한다.
- 이 결정은 정확 알람 권한 처리(`D-047`), 위치 권한 처리(`D-044`), Android force-stop 제한(`D-050`)을 대체하지 않는다.

## 결과

- 사용자가 원하지 않는 배터리 예외 요청을 피하고, 기본 Android 절전 정책 아래에서 앱을 운영한다.
- 사용자가 설치별 capability를 확인하고 필요한 시스템 설정으로 직접 이동할 수 있다.
- Android 및 제조사별로 알람·지오펜스가 지연될 수 있으므로 제품은 감지 시각을 보장하지 않으며, 기기별 검증과 도움말이 필요하다.

## 공식 근거

- [Android: Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby): 배터리 최적화 예외의 직접 요청은 일반적으로 대부분의 앱이 사용하지 않아야 한다고 안내한다.
- [Android: About background location and battery life](https://developer.android.com/develop/sensors-and-location/location/battery): 백그라운드 위치 제한과 geofence 응답성의 배터리 trade-off를 설명한다.
- [Android: ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS](https://developer.android.com/reference/android/provider/Settings#ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS): 이 API가 배터리 수명에 영향을 줄 수 있는 예외 동작임을 설명한다.
