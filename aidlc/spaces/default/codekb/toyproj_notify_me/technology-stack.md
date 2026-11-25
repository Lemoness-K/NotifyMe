# 기술 스택

## 코드에서 확인된 항목

| 영역 | 명시 버전 또는 설정 | 역할 |
|---|---|---|
| 런타임·언어 | Node.js `>=24.0.0`, TypeScript `~5.9.3` | ESM 및 로컬 SQLite 운영 |
| 공유 UI | React/React DOM `^19.0.0`, React Router `7.18.5`, Vite `^8.0.0` | 브라우저와 앱의 공유 SPA |
| API | NestJS `11.2.10`, Express 어댑터 | 인증·가구 및 업무 HTTP |
| 저장 | Prisma/SQLite adapter `7.10.1`, SQLite | 스키마, 마이그레이션과 업무 DB |
| 인증 | Firebase Web `^12.0.0`, Firebase Admin `^13.0.0`, Google Auth Library `^10.0.0` | 웹 인증과 서버 증명 검증 |
| 테스트 | Vitest `4.1.12`, Playwright `^1.60.0` | 합성 인증 및 테스트 DB, 브라우저 테스트 |
| 운영 | systemd/journald, Caddy, Tailscale Serve (모바일 가이드) | 프로세스와 HTTPS 경계 |

버전은 프로젝트의 `package.json` 기준이다. 잠금 파일이 존재하며 새 종속성 검토나 실제 운영 설치는 이번 조사에 포함하지 않았다.

## 런타임 경계

Pi에서는 Node가 Nest API와 작업을 실행하고 SQLite를 사용한다. Caddy는 정적 SPA와 API 프록시를 제공한다. Android 앱의 Capacitor 8.6.2는 패키지에 있지만 Kotlin의 실제 플랫폼 기능 상태는 재검증하지 않았다. 이전 설계는 FCM을 변경 동기화 신호에 사용한다.
