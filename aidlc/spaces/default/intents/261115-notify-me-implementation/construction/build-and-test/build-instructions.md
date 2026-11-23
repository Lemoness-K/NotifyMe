# 빌드 안내

## 환경

Node.js 24와 잠금 파일을 사용한다. 새 개발 체크아웃에서는 `npm ci`로 의존성을 설치한다. 이 실행은 기존 설치를 사용한다. 테스트 전용 SQLite, HTTPS 인증서, 합성 인증만 사용한다. 운영 DB, 키, 공개 네트워크에 연결하지 않는다.

## 실행과 확인

```bash
npm run typecheck
npm run build
```

빌드는 Prisma 생성, TypeScript 컴파일, Vite 번들링을 실행한다. `dist/server/main.js`와 웹 번들이 생성되고 각 명령이 종료 코드 0이어야 한다. ARM64 개발 환경의 브라우저 경로와 글꼴 설정은 [테스트 결과](test-results.md)의 명령을 사용한다. Prisma가 생성되지 않으면 Node 버전과 기존 잠금 파일 설치를 확인한다.

Android JVM은 프로젝트 JDK·Gradle 캐시를 사용한다. APK 조립에는 x64 Android SDK 검증 환경이 필요하다. 로컬 ARM64 결과를 실제 기기나 x64 조립 결과로 기록하지 않는다.
