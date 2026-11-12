# ADR-001: 클라이언트와 알림 아키텍처

- 상태: 승인
- 작성일: 2026-09-12
- 승인일: 2026-09-12
- 관련 결정: `D-003`~`D-009`, `D-046`~`D-057`
- 관련 요구사항: `F-CLI-001`~`F-CLI-005`, `F-TRG-001`~`F-TRG-005`, `F-NOT-001`~`F-NOT-009`, `NFR-REL-001`~`NFR-REL-006`, `PR-AC-059`

## 배경

초기 사용 단말은 Android 2대지만 향후 iOS를 고려한다(`D-003`). 앱 UI가 보이지 않을 때의 일반 시스템 알림과 자동 장소 알림이 모두 필수다(`D-004`, `D-005`). 웹 Geolocation은 보이지 않는 문서에서 위치 갱신을 전달하지 않으므로 PWA만으로 이 요구를 충족할 수 없다. 동시에 UI 중복 개발과 특정 push 제공자 종속을 줄여야 한다(`D-006`, `D-007`).

## 결정

1. 공통 화면과 일반 애플리케이션 흐름은 모바일·태블릿·데스크톱을 지원하는 반응형 Web UI로 작성한다. Web UI framework는 React Router + Vite SPA로 정했다(`D-054`).
2. Android 앱은 이 UI를 담는 Capacitor shell로 구성한다.
3. background 위치 알림은 Kotlin으로 구현한 별도 Android capability adapter module과 Android `BroadcastReceiver`가 처리한다.
4. 원격 전달은 provider-neutral `PushTransport` port 뒤에 둔다. MVP에서 FCM은 담당자 기기에
   server change sync signal을 보내는 adapter로 사용하며, 사용자에게 보이는 notification은 보내지
   않는다(`D-046`). GCM은 종료된 제품이므로 사용하지 않는다.
5. MVP 시간 알림은 동기화된 회차를 담당자 기기에 로컬 예약하고, 장소 알림은 OS geofence 전이 시
   기기가 local notification을 표시한다. FCM은 변경된 server revision을 fetch하고 local trigger를
   reconcile하라는 신호만 전달한다. due-time 알림은 FCM 수신에 의존하지 않는다.
6. push, local scheduling, geofence, permission/system settings를 각각 플랫폼 중립 port로 두고 native SDK 타입을 공유 UI와 도메인에 노출하지 않는다.
7. 같은 responsive Web UI는 브라우저 업무 클라이언트와 Capacitor shell에서 재사용한다. 브라우저는 주요 업무 CRUD를 제공하되 background 알림·geofence를 네이티브 capability가 있는 것처럼 보이지 않는다.
8. iOS 추가 시 Web UI와 port/event contract는 유지하고 Swift 기반 APNs/UserNotifications/Core Location adapter module을 추가한다.

사용자가 설치형 Android 앱으로 진행하기로 승인하여 이 ADR을 승인 상태로 전환한다(`D-008`).
FCM 변경 신호와 local time alarm의 역할은 `D-046`에서, 정확 알람 권한 거부 시 fallback 동작은
`D-047`에서, 늦은 알림의 24시간 catch-up cutoff는 `D-048`에서, FCM ChangeSignal retry·TTL은 `D-049`에서 정했다. Android force-stop 제약과 복구는 `D-050`에서, 배터리 최적화 예외를 직접 요청하지 않는 정책은 `D-051`에서 정했다. 반응형 공유 Web UI와 capability별 플랫폼 adapter 경계는 `D-052`에서, Web UI framework는 `D-054`에서, Node.js runtime 위의 NestJS API framework는 `D-055`에서, SQLite ORM은 `D-056`에서, 외부 ingress와 자동 HTTPS는 Caddy로 정했다(`D-057`, [ADR-025](./ADR-025-caddy-ddns-https-ingress.md)). iOS push provider 경로는 `Q-019`에 남긴다.

## 고려한 대안

### PWA 단독

- 장점: 설치·배포가 가장 단순하다.
- 기각 이유: 앱이 닫힌 상태의 신뢰 가능한 geofence가 불가능하고 LAN HTTP에서는 Service Worker/웹 푸시 secure-context 전제도 충족하지 못한다.

### 순수 Kotlin Android 후 Swift iOS

- 장점: 플랫폼 기능을 가장 직접적으로 제어한다.
- 보류 이유: 두 UI를 별도 유지해야 한다. 향후 네이티브 요구가 공통 UI보다 커지면 재검토한다.

### Capacitor와 커뮤니티 background-location plugin만 사용

- 장점: 초기 코드량이 작다.
- 기각 이유: 위치 알림은 핵심 요구이며 공식 Capacitor Geolocation plugin 자체는 background geolocation을 직접 지원하지 않는다. 작은 네이티브 경계를 직접 소유하는 편이 장애·권한·재부팅 동작을 검증하기 쉽다.

### 서버가 주기적으로 기기 위치를 받아 장소를 판정

- 기각 이유: 지속 위치 수집, 배터리, 통신 및 개인정보 부담이 커진다.

## 결과

### 긍정적

- Web UI 재사용과 네이티브 background 기능을 함께 얻는다.
- 장소 판정이 서버 연결과 RPi 가용성에 직접 의존하지 않는다.
- FCM/APNs 교체와 iOS 추가가 도메인 모델 변경으로 번지는 것을 제한한다.
- 정확한 연속 위치를 서버에 모으지 않는 최소 수집 설계가 가능하다.

### 비용과 위험

- JavaScript/TypeScript 영역 외에 Kotlin, 향후 Swift 코드와 테스트가 필요하다.
- Android background location 권한, 알림 권한, 제조사 절전 정책을 다뤄야 한다.
- Android geofence는 앱당 100개이고 수 분 지연될 수 있으며 재부팅 후 재등록해야 한다.
- iOS region monitoring은 앱당 20개이므로 기기별 우선순위 정책이 필요하다.
- Capacitor Push의 종료 앱 data-only 제한 때문에 일부 흐름은 native service가 필요할 수 있다.

## 검증 조건

- 담당자 기기의 변경된 알림 예약을 위한 FCM ChangeSignal이 도착하면 서버 revision을 가져와 reconcile한다.
- FCM ChangeSignal 자체는 사용자 notification tray에 표시되지 않는다.
- 이미 local alarm에 예약된 due-time 알림은 FCM 수신 없이 표시된다.
- 네트워크에서 RPi에 접근할 수 없어도 사전 동기화된 geofence가 local notification을 표시한다.
- 재부팅 뒤 geofence가 재등록된다.
- reminder 수정·취소 뒤 기기 예약 상태가 version 기반 reconcile로 수렴한다.
- 중복 FCM ChangeSignal 또는 geofence event가 중복 예약·알림을 만들지 않는다.
- provider SDK 타입이 Reminder/Occurrence 도메인 모듈에 노출되지 않는다.

## 후속 결정

- iOS push 경로의 열린 질문은 [사용자 결정 및 질문 등록부](../decision-register.md)의 `Q-019`에서 관리한다.

## 공식 근거

- W3C Geolocation: https://www.w3.org/TR/geolocation/
- W3C Secure Contexts: https://www.w3.org/TR/secure-contexts/
- Android Geofencing: https://developer.android.com/develop/sensors-and-location/location/geofencing
- Firebase FCM architecture: https://firebase.google.com/docs/cloud-messaging/fcm-architecture
- Firebase Android receive behavior: https://firebase.google.com/docs/cloud-messaging/android/receive-messages
- GCM to FCM migration: https://developers.googleblog.com/en/time-to-upgrade-from-gcm-to-fcm/
- Capacitor Push Notifications: https://capacitorjs.com/docs/apis/push-notifications
- Capacitor Geolocation: https://capacitorjs.com/docs/apis/geolocation
- Apple region monitoring: https://developer.apple.com/documentation/CoreLocation/monitoring-the-user-s-proximity-to-geographic-regions
- Apple User Notifications: https://developer.apple.com/documentation/usernotifications/
