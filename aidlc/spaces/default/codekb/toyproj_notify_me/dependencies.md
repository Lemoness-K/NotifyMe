# 의존성 분석

## 외부 패키지 의존성

코드 manifest와 lockfile이 없어 실제 외부 패키지 dependency graph는 없다. 문서상 예정된 외부 기술 및 역할은 다음과 같다.

| 이름 | 계획된 사용 | 상태 |
|---|---|---|
| React Router, Vite | 공유 SPA UI | 선택됨, 미구현 |
| Capacitor | Android WebView 앱 셸 | 계획, 미구현 |
| NestJS, Node.js | API 및 Worker | 선택됨, 미구현 |
| Prisma ORM 7, `@prisma/adapter-better-sqlite3` | SQLite 접근과 migration | 선택됨, 미구현 |
| SQLite | 로컬 영속 저장소 | 선택됨, 미구현 |
| Firebase Authentication | Google 로그인 | 선택됨, 미구현 |
| Firebase Cloud Messaging | 비사용자용 변경 동기화 신호 | 선택됨, 미구현 |
| Caddy | HTTPS ingress·정적 파일·reverse proxy | 선택됨, 미구현 |
| Android SDK / Kotlin | 알람·알림·geofence adapter | 기술 경계 계획, 미구현 |
| Raspberry Pi OS `systemd`/`journald` | process supervision·운영 로그 | 선택됨, 미구현 |

정확한 패키지 버전, transitive dependency, license, lockfile, 취약점 상태는 확인할 수 없다.

## 문서화된 의존 방향

- 공유 UI는 HTTP API와 platform-neutral capability ports에 의존하도록 계획됐다.
- NestJS application은 도메인 규칙을 ORM과 framework 타입에서 분리하도록 설계됐다.
- Prisma repository가 SQLite에 접근하며 API와 단일 Worker가 persistence를 공유한다.
- 플랫폼 adapter가 OS API, FCM/identity provider와 연결되는 경계를 맡는다.
- Caddy가 인터넷 ingress를 단일화하고 API·DB 포트를 외부에 직접 노출하지 않는 방향이다.

이는 설계 의존 방향이며 실제 import adjacency list가 아니다. 현재 package 간 참조·순환 의존성은 없음(코드 부재로 미관찰).
