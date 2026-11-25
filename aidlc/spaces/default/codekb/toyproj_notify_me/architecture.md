# 아키텍처 분석

## 시스템 개요

공유 React SPA와 NestJS API가 단일 Raspberry Pi 배포에서 SQLite를 사용한다. 모바일 접속 가이드의 HTTPS 종단은 Tailscale Serve이며, Caddy는 loopback에서 정적 파일을 제공하고 API를 loopback NestJS로 전달한다. 실제 운영 호스트에는 접속하지 않았다.

## 아키텍처 스타일

단일 Node 런타임이 API와 작업을 관리한다. Firebase Admin과 Google Auth Library는 서버의 인증 제공자 경계를 구현하고, Prisma adapter는 SQLite에 접근한다. Android 네이티브 어댑터와 알림·동기화 흐름은 이전 설계의 구분을 보존한다.

## 구성요소 관계

```mermaid
flowchart LR
    W[모바일 Chrome] -->|Tailscale HTTPS| T[Tailscale Serve]
    T --> C[Caddy]
    C -->|정적 파일| S[공유 웹 SPA]
    C -->|API 프록시| A[NestJS]
    A --> F[Google 및 Firebase 검증]
    A --> D[(SQLite)]
    O[로컬 운영 CLI] --> D
```

브라우저는 Tailscale Serve와 Caddy를 통해 웹/API를 사용한다. 앱은 서버에서 검증한 인증을 SQLite의 사용자·세션·가구 상태와 연결한다. 부트스트랩은 별도 로컬 CLI다.

## 데이터 흐름

- 브라우저는 챌린지 발급 후 Google·Firebase 인증을 거친다. 앱 세션이 발급되면 동일 출처 API와 `GET /api/v1/me`로 소속을 확인한다.
- 관리형 운영 기동은 활성화 증거·DB 세대·삭제 원장 확인과 발행을 마친 뒤 HTTP 응답과 작업을 허용한다. 복구는 별도의 후보 DB에서 재연산한 상태로 전환한다.
- 리마인더와 설정의 기존 데이터 흐름은 활성 가구 멤버십과 대상 가구 경계를 사용한다. Android 변경 신호·예약은 이전 설계 범위이며 이번 조사에서 재검증하지 않았다.

## 문서상 설계 결정

- `D-052` 공유 TypeScript와 플랫폼 중립 기능 경계, `D-053` Pi SQLite, `D-054` React Router/Vite SPA, `D-055` NestJS, `D-056` Prisma.
- `D-057` Caddy 진입점과 `D-077` systemd 프로세스 운영. 현재 모바일 가이드는 Serve를 HTTPS 종단으로 배치한다.
- `D-074` 최초 관리자와 가구 등록은 Firebase identity 기준의 CLI 명령이다.

## Interaction Diagrams

### 최초 관리자 등록과 브라우저 로그인

```mermaid
sequenceDiagram
    participant O as 운영자 CLI
    participant A as 서버 인증
    participant D as SQLite
    participant W as 브라우저
    O->>A: Firebase 인증 증명 전달
    A->>D: 사용자 연결 및 가구와 ADMIN 원자 생성
    W->>A: Google 및 Firebase 증명으로 세션 요청
    A->>D: 활성 사용자 확인과 챌린지 소비 및 세션 생성
    A-->>W: 세션 쿠키
    W->>A: 프로필과 활성 가구 조회
```

CLI에서 설정을 마친 뒤 브라우저의 로그인 요청이 일반 세션을 받는다. 후보 예약·확인은 기존 순서에 없다.

## 이전 설계의 상호작용 참고

### Reminder 생성 및 기기 동기화

```mermaid
sequenceDiagram
    participant U as 사용자
    participant W as 공유 Web UI
    participant C as Caddy
    participant A as NestJS API
    participant DB as SQLite 저장소
    participant F as FCM 동기화 adapter
    participant D as 담당 Android 설치
    U->>W: Reminder 정보 입력
    W->>C: HTTPS API 요청
    C->>A: API reverse proxy
    A->>A: 인증·household 권한 확인
    A->>DB: Reminder·Occurrence·revision 저장
    A->>F: 변경 신호 발행 예약
    F-->>D: 업무 내용 없는 동기화 신호
    D->>A: 최신 revision 조회
    A->>DB: 최신 상태 읽기
    A-->>D: 담당 설치의 현재 Trigger
    D->>D: OS 알람·geofence reconcile
```

텍스트 설명: 서버가 Reminder와 회차를 저장한 뒤 대상 설치에 동기화 신호를 보낸다. 설치는 최신 상태를 다시 가져와 로컬 Trigger를 맞춘다. FCM 자체를 사용자 표시 알림으로 사용하지 않는다.

### Android 장소 알림

```mermaid
sequenceDiagram
    participant OS as Android 위치 서비스
    participant N as Kotlin geofence adapter
    participant L as 로컬 알림 adapter
    participant API as NestJS API
    OS->>N: 장소 조건 event callback
    N->>N: 중복 event 억제·회차 상태 확인
    N->>L: 유효한 event 표시 요청
    L->>OS: 시스템 알림 게시
    N->>API: event metadata 동기화
```

텍스트 설명: geofence event는 네트워크 응답을 기다리지 않고 로컬 알림으로 이어진다. 실제 OS 감지 시각에 대한 고정 SLA는 문서화되어 있지 않다.

## 개선 및 검증 기회

후속 설계에서 설치 의도와 복구·가구 종료를 구분하는 상태, 후보가 일반 사용자로 접근하기 전의 권한, 기존 로그인과 초대 회귀를 다룬다. 실제 Android 시스템 알림 동작은 별도 기기 검증 범위로 남아 있다.
