# 의존성 분석

## 외부 패키지 의존성

버전 및 역할은 [기술 스택](technology-stack.md)에 정리했다. 인증과 배포의 연결은 다음과 같다.

- `src/web/client.ts`는 Google Identity Services로 Google credential을 받고 Firebase Web SDK로 교환한다. PC와 모바일 브라우저가 공유하는 흐름이다.
- `src/server/provider.ts`는 Firebase Admin으로 Firebase 증명을, Google Auth Library에 설정한 OAuth 클라이언트로 Google 증명을 검증한다. 테스트 제공자는 별도 격리 모드로 연결한다.
- `src/server/storage.ts`는 Prisma와 better-sqlite3 기반 adapter를 사용한다. 로컬·복구 SQL 실행은 Node의 `node:sqlite`에 의존한다.
- `src/server/config.ts`는 인증 설정을 분리한다. 대상 모드의 API는 loopback에 바인딩하고 단일 HTTPS origin을 요구한다.
- Caddy 예제는 내부 API 프록시와 정적 웹 배포를 제공한다. 모바일 가이드는 동일 tailnet의 Serve를 앞에 둔다.

## 내부 의존 방향

부트스트랩·일반 로그인 → 인증 제공자와 Prisma 저장소. 보호된 API → 활성 사용자·세션 → 가구 역할·소속. 초대 → 검증된 이메일·가구 멤버십 결과 → 일반 로그인. 관리형 기동 → 활성화 파일·DB 세대·권위 원장 검사 → API와 작업 기동.

## 이전 설계의 외부 경계

Android SDK/Kotlin은 알람·권한·지오펜스를, FCM은 변경 신호를 담당한다. 그 경계의 전이 의존성이나 런타임 검증은 이번 조사 범위에 포함하지 않았다.
