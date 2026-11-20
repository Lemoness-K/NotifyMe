# U4 인프라 명세

## Sources

`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `components.md`, `functional-spec.md`, `contract-summary.md`를 적용한다.

## Deployment

| Facet | Choice | Rationale |
| --- | --- | --- |
| Compute | 기존 Raspberry Pi ARM64·systemd·Node.js 24 | 동일 프로세스가 설치 계획과 변경 신호를 저장한다. |
| Network | Caddy HTTPS와 고정 API 호스트, 서버에서 FCM으로 제한된 HTTPS egress | 기기와 서버의 인증·동기화를 유지한다. |
| Storage | 기존 SQLite 트랜잭션, Android 보호 저장소·백업 제외 카탈로그 | 토큰·세션을 앱 JS와 외부 백업에서 격리한다. |
| Environments | ARM64 로컬 TS와 JVM, x64 Android SDK 빌드, 별도 테스트용 두 실기기 | 소프트웨어 회귀·실제 OS 알림·대상 Pi 성능에 각각 증거를 남긴다. |
| IaC | 기존 systemd 환경 파일과 CI로 조립 | 추가 서버·메시지 브로커 없이 운영한다. |
| Resource sizing | 고유 지오펜스 최대 100, 후보 페이지와 발송 배치 상한 | 실제 Pi p95와 RSS·쓰기량은 DS-014에서 측정한다. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
| --- | --- | --- | --- |
| SQLite | 운영 저장소 | 설치·가구·epoch 인덱스와 짧은 트랜잭션 | 여러 후보의 검증·저장·outbox는 원자적으로 적용한다. |
| FCM | 변경 신호 | 기존 Firebase 연동의 서버 자격과 환경별 Android 설정 | 업무 저장 후 비동기 best-effort, 생산 자격 없이 대역 검증 가능 |
| OS | 예약 및 상태 | 앱 별도 채널, 정확 알람 fallback, 위치 감시 | [Android 알람](https://developer.android.com/develop/background-work/services/alarms), [지오펜스](https://developer.android.com/develop/sensors-and-location/location/geofencing) |
| Caddy | TLS ingress | 등록·동기화·이벤트는 기존 인증 API로 한정 | 로컬 상태·관리 경로는 공개하지 않는다. |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
| --- | --- | --- | --- |
| Google/Firebase 인증과 세션 | U1 | U4 | `POST /api/v1/sessions/challenges`의 nonce와 challenge 쿠키를 수신한다. Google은 기존 서버 OAuth client ID와 nonce를 사용한다. `POST /api/v1/sessions`에 Firebase Bearer, Google ID token 및 같은 쿠키를 보낸다. 서버가 만료·subject·nonce·auth_time을 비교하고 challenge를 한 번만 소비한다. 이후 API는 앱 세션과 Firebase 자격을 네이티브 경계에서 사용한다. |
| 가구 접근과 계획 | U2·U3 | U4 | 회수의 기존 설치 캡처와 상태 원자 저장, 계획 소유 및 설치 대상을 분리한다. |
| epoch 교체 | U5 | U4 | 복구 후 새 세대를 발급한다. 이전 범위의 제거를 다시 시작한 기기는 실제 제거 뒤에도 새 대기 FULL의 현재 로컬 계정·scope·요청 세대를 확인한다. 로그아웃·회수·더 최신 요청이라면 대기 FULL을 폐기한다. |

## Application Boundaries

시간대·알림 채널·공유 웹·현지화의 정책은 기기와 앱에서 검증한다. 앱 JavaScript는 번들된 UI·코드만 실행하고 고정된 API 동작을 브리지로 호출한다. 외부 탐색 및 비밀값은 브리지에 넘기지 않는다. 권한과 토큰이 모두 확인되어야 실제 운영 공급자와 통신한다.
