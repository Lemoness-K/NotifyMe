# 기술 스택

## 코드에서 확인된 항목

애플리케이션 언어, runtime, framework, DB, toolchain 및 버전은 manifest나 source로 확인되지 않았다. 코드 구현이 없는 설계 repository이므로 아래 표는 문서상 선택 또는 제안이다.

| 영역 | 문서상 계획 | 구현 확인 |
|---|---|---|
| 공유 UI | TypeScript, React Router framework mode, Vite SPA (`ssr: false`) | 아니오 |
| Android | Capacitor shell, Kotlin capability adapters | 아니오 |
| API | Node.js runtime, NestJS modular monolith | 아니오 |
| Persistence | SQLite, Prisma ORM 7, `@prisma/adapter-better-sqlite3` | 아니오 |
| Identity | Firebase Authentication, Google provider | 아니오 |
| Change signal | Firebase Cloud Messaging (FCM) | 아니오 |
| Ingress | Caddy, DDNS hostname, automatic HTTPS | 아니오 |
| Raspberry Pi 운영 | ARM64 대상, systemd, journald | 아니오 |

## 버전·호환성 상태

Prisma major version 7만 명시적으로 고정되어 있다. 다른 framework, runtime, adapter, OS 및 native library의 구체 버전은 선택되지 않았다. 설계 문서는 Node.js·Prisma·SQLite native adapter의 실제 ARM64 호환성을 구현 착수 때 확인하라고 남긴다. lockfile이나 dependency manifest는 없다.

## 런타임 경계

목표 구성은 RPi의 Node.js API/Worker와 SQLite 파일, Caddy ingress, 정적 UI build, 그리고 별도 Android 설치 앱이다. Docker Compose는 MVP에 사용하지 않는 결정이 문서화되어 있다. 이 runtime이 현재 환경에 설치·실행된다는 증거는 없다.
