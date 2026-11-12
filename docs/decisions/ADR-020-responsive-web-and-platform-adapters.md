# ADR-020: 반응형 공유 Web UI와 플랫폼별 네이티브 어댑터

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-003`, `D-006`, `D-008`, `D-052`, `D-054`~`D-056`
- 관련 요구사항: `F-CLI-001`~`F-CLI-005`, `PR-AC-012`, `PR-AC-043`

## 맥락

MVP는 Android의 로컬 알람, 시스템 알림, geofence와 권한을 사용하지만 같은 제품 흐름을 브라우저에서도
제공하고 싶다. 화면을 여러 화면 크기에 맞게 지원하고, 향후 iOS 등 다른 플랫폼을 추가할 때 도메인과
공유 UI에 특정 운영체제 SDK가 전파되지 않도록 경계를 정해야 한다.

## 결정

- 공유 사용자 화면과 일반 업무 흐름은 TypeScript 기반 반응형 Web 앱으로 구현하고, Capacitor Android
  WebView와 직접 접속 브라우저에서 재사용한다. Web UI framework는 `D-054`에서 React Router + Vite SPA로 정했다. API는 Node.js runtime 위에서 NestJS로 실행하고(`D-055`), SQLite는 Prisma ORM 7로 접근한다(`D-056`).
- 주요 화면은 고정된 기기 해상도에 의존하지 않는다. 최소 320 CSS px부터 1920 CSS px 이상까지 주요 업무
  흐름을 지원하고, 넓은 화면은 콘텐츠 최대 폭을 적용한다(`PR-AC-043`).
- 브라우저 클라이언트는 인증·가구·리마인더 주요 CRUD와 동기화 흐름을 제공한다. OS background alarm,
  notification, geofence는 지원되는 등록 플랫폼 adapter 설치의 capability로 안내한다.
- 플랫폼 의존 기능은 알림 예약·geofence·권한·system settings·native message receive 등 capability별
  platform-neutral port/event contract를 통해 호출한다. 공유 UI와 도메인 코드는 Kotlin, Swift 또는 OS SDK
  타입에 직접 의존하지 않는다.
- MVP Android 구현은 Kotlin adapter module로 나눈다. 후속 iOS 구현은 동일한 port/event contract에 Swift
  adapter module을 추가한다. 각 플랫폼은 capability 지원 여부를 명시하며 추가 플랫폼 지원을 자동으로
  가정하지 않는다.

## 결과

- Web UI 하나로 브라우저와 Capacitor 앱에서 주요 업무 흐름을 공유할 수 있다.
- 브라우저는 화면을 통해 업무를 관리하지만, 모바일 OS가 제공하는 백그라운드 알림 기능이 브라우저에도
  있다고 약속하지 않는다.
- Kotlin·Swift·OS SDK 코드가 native adapter module에 머물러 UI와 도메인 로직을 유지하며 플랫폼을 늘릴 수 있다.
- API framework는 Node.js runtime 위에서 NestJS를 사용하고(`D-055`), SQLite ORM은 Prisma ORM 7로 정했다(`D-056`). MVP 데이터베이스는 SQLite다(`D-053`). React Router + Vite SPA 결정은 [ADR-022](./ADR-022-react-router-vite-spa.md)를 따른다(`D-054`).

## 추적성

- 반응형 UI, browser CRUD, 플랫폼별 capability 분리와 공통 adapter contract는 `PR-AC-012`, `PR-AC-043`으로 검증한다.
- 앱 OS capability는 `F-CLI-003`~`F-CLI-005`, platform ports는 `docs/03-system-architecture.md`의 Port 경계를 따른다.
