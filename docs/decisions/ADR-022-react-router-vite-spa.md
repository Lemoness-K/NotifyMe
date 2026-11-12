# ADR-022: React Router와 Vite SPA로 공유 Web UI 구성

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-052`, `D-054`~`D-056`
- 관련 요구사항: `PR-AC-043`
- 관련 문서: [시스템 아키텍처](../03-system-architecture.md), [ADR-020](./ADR-020-responsive-web-and-platform-adapters.md)

## 맥락

UI는 모바일·태블릿·데스크톱 브라우저와 Capacitor Android WebView에서 재사용하는
TypeScript 기반 반응형 Web 앱이어야 한다(`D-052`). 앱은 별도 Node.js API와 통신하며,
초기 서버 환경은 Raspberry Pi다. 브라우저와 앱에 별도의 UI 구현·배포 방식을 만들지 않고,
서버 렌더링도 사용하지 않는 선택이 필요하다.

React 공식 문서는 새 React 앱을 시작할 때 framework 사용을 권장한다. React Router는
Vite 기반 framework mode와 SPA mode를 제공하며, `ssr: false` 설정으로 서버 렌더링 없이
정적 진입 문서를 생성할 수 있다([React 앱 구성](https://react.dev/learn/creating-a-react-app),
[React Router SPA mode](https://reactrouter.com/how-to/spa), [Vite guide](https://vite.dev/guide/)).

## 결정

- MVP Web UI는 React Router framework mode를 Vite SPA mode(`ssr: false`)로 구성한다.
- 브라우저와 Capacitor WebView는 같은 정적 build 산출물을 사용한다.
- UI는 서버 렌더링이나 자체 서버 런타임에 의존하지 않고 Node.js API와 통신한다.
- Node.js runtime 위의 API framework는 NestJS(`D-055`), SQLite ORM은 Prisma ORM 7(`D-056`)로 정했다.
- 브라우저에 OS 백그라운드 알림·지오펜스 기능이 있다고 가정하지 않는다(`D-052`).

## 결과

### 장점

- 같은 UI 코드를 브라우저와 Capacitor WebView에서 사용한다.
- 정적 build로 브라우저 UI를 제공할 수 있어 RPi에 UI 전용 서버 렌더링 런타임을 추가하지 않는다.
- React Router framework conventions와 Vite build 체계를 사용하면서 SSR을 선택적으로 제외한다.

### 고려할 점

- SPA deep link를 직접 열 수 있도록 정적 host가 route fallback을 제공해야 한다.
- 브라우저 UI와 API의 origin·HTTPS·CORS 정책은 배포 설계에서 확정해야 한다.
- 프레임워크와 빌드 도구의 버전 업데이트 및 Capacitor WebView 호환성을 의존성 관리에서 검토한다.

## 고려한 대안

- **React를 직접 조립하고 Vite만 사용**: 간결하지만 routing, data loading과 프로젝트 관례를 별도로 선택·관리해야 한다.
- **SSR을 켠 React Router**: 첫 응답 렌더링과 server rendering이 필요할 때 검토할 수 있지만, 같은 UI를 정적 asset으로 담는 MVP 요구에는 서버 런타임을 더한다.
- **다른 UI framework**: 현재 결정한 TypeScript 공유 UI와 React 생태계 기준을 다시 검토해야 하므로 MVP 선택으로 두지 않는다.

## 재검토 조건

SEO, SSR 기반 초기 응답, 브라우저와 native UI의 구조적 분리, Capacitor 호환성 문제가
구체적으로 확인되면 SPA 여부와 framework mode를 재검토한다.
