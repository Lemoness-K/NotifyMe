# 최초 관리자 온보딩의 기존 구현 조사

## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply** (17개):
  - `src/server/auth.ts`
  - `src/server/bootstrap-admin.ts`
  - `src/server/config.ts`
  - `src/server/provider.ts`
  - `src/server/storage.ts`
  - `src/server/main.ts`
  - `src/server/operations/activation.ts`
  - `src/server/operations/restore.ts`
  - `src/server/operations/runtime.ts`
  - `src/web/client.ts`
  - `prisma/migrations/202611180001_u1/migration.sql`
  - `tests/u1/auth-session.test.ts`
  - `tests/e2e/u1/core-flow.spec.ts`
  - `deploy/u1/Caddyfile.example`
  - `deploy/u5/README.md`
  - `docs/u1-local-run.md`
  - `package.json`
- **Skimmed only**: API 컨트롤러·가구 저장소와 화면의 관련 구간, Prisma 모델 목록, 변경 영향 문서, U2 초대·U5 복구 테스트의 관련 사례와 이전 완료 기록. 이 범위의 상세 검증은 후속 설계·테스트에서 진행한다.
- **Left out**: Android 네이티브 소스와 새 변경에 직접 관계없는 업무 모듈, 생성된 Prisma 클라이언트, 의존성·빌드 출력·테스트 결과 폴더, 로컬 데이터·환경 파일, 프레임워크 설치물.

### Packages Found

- `notify-me`, 단일 npm 패키지. TypeScript 서버와 공유 Web UI를 빌드한다. 별도의 Android 셸은 이번 깊은 분석 범위 밖이다.

### Build System

- **Type**: Node.js 24 이상, npm.
- **Config Files**: `package.json`, `prisma/schema.prisma`, 저장소의 TypeScript와 Vite 설정.
- **Build Dependencies**: `prisma generate` → TypeScript 서버 컴파일 → Vite 웹 번들. 서버가 Prisma SQLite adapter와 인증 SDK를 사용한다.

### APIs Discovered

- 보호된 API는 `src/server/http.ts`의 `/api/v1` 아래에 있다. 로그인 챌린지·세션 발급·해제, 프로필, 초대 수락, 가구 초대·구성원, 리마인더와 설치 관련 흐름을 확인했다.
- `src/server/bootstrap-admin.ts`의 `admin:bootstrap`은 서버 CLI 경로다. 최초 관리자 후보·확인·취소를 처리하는 웹 명령은 이번 기준의 세션 경로에서 제공되지 않는다.
- `src/server/operations/activation.ts`와 `restore.ts`는 보호된 복구 상태와 파일 세대를 검사한다. 이 상태는 데이터베이스를 서비스에 연결하는 복구 경계다.

### Frameworks & Libraries

- NestJS 11.2.10, Prisma·SQLite adapter 7.10.1, React Router 7.18.5. 나머지는 `package.json`에 명시된 범위로 Firebase Web 12, Firebase Admin 13, Google Auth Library 10, React 19, Vite 8.

### Test Coverage

- **Test Directories**: `tests/u1` 인증/HTTP/웹, `tests/e2e/u1` 터치·HTTPS 종단 검증, `tests/u2` 가입, `tests/u5` 복구·시작 차단.
- **Test Frameworks**: Vitest 및 Playwright Chromium. `package.json`의 `test:coverage`는 V8 제공자를 사용한다.
- **기존 검증 기록**: 기존 구현의 Build and Test 기록에는 Vitest 214개, Chromium 4개, 라인 커버리지 87.16%가 기록됐다. Performance Validation의 Pi ARM64 실행은 외부 로그인과 TLS를 제외했다. 이번 조사는 읽기 전용으로 실행 결과를 재현하지 않았다.

### Code Quality Indicators

- **Linting**: 이번 분석은 npm 명령과 관찰된 코드에 한정한다. 별도 lint 결과가 없다.
- **CI/CD**: 로컬 실행 가이드에 앱 CI와 `verify:u1` 경로가 기록돼 있다.
- **Documentation**: `docs/u1-local-run.md`에 현재 Tailscale 연결과 CLI 등록 절차가 있다. 기존 제품 추적표의 일부 구현 상태는 실제 코드와 다르다.

### Technical Debt Signals

- `src/server/auth.ts`의 부트스트랩은 가구 행 존재 여부와 싱글턴 제약으로 중복 생성을 막지만 설치 이력은 별도로 판정하지 않는다.
- `src/server/storage.ts`의 임시/복구 마이그레이션 목록과 배포의 Prisma 마이그레이션 경로를 함께 검토해야 한다.
- `src/web/client.ts`의 Firebase 인증은 메모리 지속성을 사용한다. 새로고침으로 현재 브라우저 인증 상태가 사라지는 경계와 서버 후보의 만료·재시도를 함께 정해야 한다.
- 관리형 복구에서 세션과 로그인 챌린지를 제거하는 기존 흐름은 후보 상태 처리도 검토할 지점이다.

## Handoff Summary

- **Intent-relevant finding**: 최초 개설은 검증된 Firebase identity의 `User/AuthIdentity`, 싱글턴 `Household`, `ADMIN` 역할을 한 트랜잭션에서 생성한다. 브라우저의 기존 로그인 경로는 Google nonce·신원·시간을 검증한 뒤 활성 내부 사용자 연결을 요구한다. 근거는 `src/server/auth.ts`의 `bootstrapAdmin`과 `SessionService.issue`다.
- **Risks / follow-up**: 최초 후보 권한과 일반 세션을 구분하고, 운영자의 의도적 설치 상태와 복구 가능 상태를 독립적으로 확인해야 한다. 닫힌 가구·복원된 오래된 상태·마이그레이션 이전 설치에서는 빈 테이블만 보고 신규 등록을 열 수 없다. 기존 초대의 검증된 대상 이메일과 가입 순서를 유지해야 한다. 소스 검색에서 가구 종료 API는 확인하지 못했으며, 종료 정책은 승인된 별도 설계에 있다.
