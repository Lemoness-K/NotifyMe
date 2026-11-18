# Notify Me U1 실행

U1에서는 Google과 Firebase로 로그인하고, 최초 가구에 속한 사용자가 시간 리마인더를 등록하고 다시 조회할 수 있다. 웹은 브라우저 언어에 따라 한국어와 영어를 선택한다. 다른 언어의 브라우저는 한국어로 시작하며 문구 리소스는 `src/web/messages.ts`에서 관리한다.

## 실행 환경

Node.js 24, npm, OpenSSL, Chromium 실행에 필요한 시스템 라이브러리를 준비한다. 아래 명령은 임시 데이터베이스와 임시 HTTPS 인증서를 프로젝트의 무시 경로에 저장한다. 실행 디렉터리는 저장소 루트다.

```bash
npm ci
npm run build
umask 077
mkdir -p .local/u1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' \
  -addext 'subjectAltName=IP:127.0.0.1' -keyout .local/u1/key.pem -out .local/u1/cert.pem
export NOTIFY_MODE=local NOTIFY_SYNTHETIC_AUTH=1
export NOTIFY_SYNTHETIC_KEY="$(openssl rand -hex 32)"
export NOTIFY_HOST=127.0.0.1 NOTIFY_PORT=3443 NOTIFY_ORIGIN=https://127.0.0.1:3443
export NOTIFY_DATABASE_PATH="$PWD/.local/u1/notify.db" DATABASE_URL="file:$PWD/.local/u1/notify.db"
export NOTIFY_TLS_KEY_FILE="$PWD/.local/u1/key.pem" NOTIFY_TLS_CERT_FILE="$PWD/.local/u1/cert.pem"
npm run migrate
npm run admin:bootstrap -- --synthetic
npm start
```

`https://127.0.0.1:3443`에 접속한다. 관리자는 빈 데이터베이스에 한 번만 생성한다. 같은 SQLite 파일을 유지하면 재시작 후에도 리마인더가 남는다. 서버 변경 시 `npm run build` 후 서버를 다시 시작한다.

## 인증 계약과 오류

- `GET /api/v1/client-config`로 공개 브라우저 설정을 읽는다.
- `POST /api/v1/sessions/challenges`로 임시 쿠키와 로그인 난수를 발급한다. Google 응답에 같은 난수를 넣고, 해당 Google 자격을 Firebase 자격으로 교환한다.
- `POST /api/v1/sessions`는 Firebase Bearer 토큰, 임시 쿠키, 본문 `googleToken`의 신원과 난수를 검증한다. 유효한 요청은 재사용할 수 없는 로그인 요청을 소비하고 서버 세션 쿠키를 발급한다. 보호된 API에는 Firebase Bearer 토큰과 같은 세션 쿠키가 모두 필요하다.
- `GET /api/v1/me`는 사용자의 기본 신원과 참여 가구를 반환한다. 참여 가구가 있으면 시간 입력 화면에 필요한 `defaultTimeZone`을 함께 반환한다.
- `DELETE /api/v1/sessions/current`는 해당 브라우저 세션을 취소한다. 등록과 로그아웃은 `Idempotency-Key`가 필요하며 모든 변경 요청은 정확한 HTTPS 출처와 일치해야 한다.
- 인증 실패는 `401 UNAUTHENTICATED`, 공급자 장애는 재시도 지시가 있는 `503 AUTH_PROVIDER_UNAVAILABLE`이다. 존재하지 않거나 참여 권한이 없는 가구는 같은 `403 HOUSEHOLD_ACCESS_DENIED` 응답을 받는다. 오류에는 원문 입력이나 자격 증명 대신 안정된 오류 코드와 요청 ID가 포함된다.
- 로그인한 상태에서 보호 API가 `401`을 반환하면 웹은 가구 데이터와 작성 중인 폼을 지우고 다시 로그인하도록 안내한다. `503` 또는 응답 유실로 등록 결과를 확인하지 못한 경우, 같은 로그인 세션에서 화면을 오가더라도 같은 입력으로 재제출하면 기존 요청 키를 사용한다. 이 키는 탭 메모리에만 보관한다.
- 로컬 합성 구성에서만 `POST /api/v1/sessions/local-proof`를 사용할 수 있다. 대상 모드는 합성 및 에뮬레이터 설정이 있거나 공급자 설정이 빠진 경우 시작을 거부한다.
- 제목 200자, 설명 4,000자, 담당자 100명과 32 KiB의 JSON 본문 한도를 적용한다. 제목과 설명의 원문 형식은 저장과 표시에서 유지한다.

## 대상 구성

`deploy/u1/Caddyfile.example`의 예제 주소를 대상의 비공개 네트워크 주소와 호스트명으로 바꾼다. Caddy가 해당 주소에서 HTTPS를 제공하고 API를 loopback의 Node 서버로 전달한다. Caddy 접근 로그는 활성화하지 않는다. Node는 요청 ID, 라우트 패턴, 결과 유형, 상태, 처리 시간을 기록한다. `deploy/u1/notify-me.service.example`에 서비스 계정과 systemd 구성이 있다. 대상의 프로세스 상태는 `systemctl status notify-me`와 로컬의 `http://127.0.0.1:3443/internal/health`에서 확인한다.

`NOTIFY_MODE=target`, `NOTIFY_ORIGIN`, `NOTIFY_DATABASE_PATH`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`를 설정한다. 두 DB 설정은 서비스 계정의 전용 저장소인 `/var/lib/notify-me/` 내부의 같은 파일을 가리킨다. Firebase 자격 증명 파일은 작업 트리 밖에서 관리한다. 초기 관리자는 마이그레이션 후 검증할 Firebase ID 토큰을 보호된 표준 입력으로 `npm run admin:bootstrap`에 한 번 전달해 만든다.

대상 모드에서는 `NOTIFY_AUTH_VERIFY_TIMEOUT_MS`(기본 2,000ms, 범위 100–10,000ms)로 요청당 인증 공급자 검증 기한을, `NOTIFY_AUTH_VERIFY_RETRIES`(기본 1회, 범위 0–2회)로 일시 장애 시 앱의 재시도 횟수를 설정할 수 있다. 세션 발급에서 Firebase와 Google 검증은 같은 기한과 재시도 예산을 사용한다. 잘못된 자격 증명은 재시도 없이 거절한다. 기한이 지나면 서버는 `503 AUTH_PROVIDER_UNAVAILABLE`을 반환하고 늦게 끝난 SDK의 검증 결과를 폐기한다.

## 검증

`npm exec -- playwright install --with-deps chromium`으로 브라우저 환경을 준비하고 `npm run verify:u1`로 타입 검사, 빌드, 라인 커버리지 80% 검사와 브라우저 종단 검증을 실행한다. GitHub Actions에서는 `.github/workflows/u1-app-ci.yml`이 같은 명령을 사용한다.

실제 비운영 Google·Firebase 로그인은 승인된 테스트 자격이 준비되면 별도로 확인한다. 개발 호스트의 검증 결과와 대상 Raspberry Pi 환경의 검증 결과는 별도로 기록한다.

승인된 U1 인프라 설계 검토의 자동 추적 검사 결과는 FAIL이다. 검사기가 이전 NFR 설계의 입력 식별자를 인식하지 못했다. 당시 리뷰는 인프라 설계표의 12개 연결을 수동 대조했다. 자동 검사 결과와 수동 대조는 `infrastructure-design/reviews/review-01.md`에 기록되어 있다.
