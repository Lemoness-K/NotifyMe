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

`https://127.0.0.1:3443`에 접속한다. 위의 합성 관리자 생성은 로컬 테스트 준비에만 사용한다. 같은 SQLite 파일을 유지하면 재시작 후에도 리마인더가 남는다. 서버 변경 시 `npm run build` 후 서버를 다시 시작한다.

## 인증 계약과 오류

- `GET /api/v1/client-config`로 공개 브라우저 설정을 읽는다.
- `POST /api/v1/sessions/challenges`로 임시 쿠키와 로그인 난수를 발급한다. Google 응답에 같은 난수를 넣고, 해당 Google 자격을 Firebase 자격으로 교환한다.
- `POST /api/v1/sessions`는 Firebase Bearer 토큰, 임시 쿠키, 본문 `googleToken`의 신원과 난수를 검증한다. 유효한 요청은 재사용할 수 없는 로그인 요청을 소비하고 서버 세션 쿠키를 발급한다. 보호된 API에는 Firebase Bearer 토큰과 같은 세션 쿠키가 모두 필요하다.
- 허용된 신규 설치에서는 모바일 웹이 같은 세션 요청에서 설정 분기를 선택한다. 후보 자격은 일반 앱 세션과 별개다. `GET/DELETE /api/v1/setup/candidate`는 현재 후보 조회·취소, `POST /api/v1/setup/confirm`은 최초 등록을 확정한다. 후보용 쿠키와 현재 검증된 Firebase 계정이 모두 필요하다.
- `GET /api/v1/me`는 사용자의 기본 신원과 참여 가구를 반환한다. 참여 가구가 있으면 시간 입력 화면에 필요한 `defaultTimeZone`을 함께 반환한다.
- `DELETE /api/v1/sessions/current`는 해당 브라우저 세션을 취소한다. 등록과 로그아웃은 `Idempotency-Key`가 필요하며 모든 변경 요청은 정확한 HTTPS 출처와 일치해야 한다.
- 인증 실패는 `401 UNAUTHENTICATED`, 공급자 장애는 재시도 지시가 있는 `503 AUTH_PROVIDER_UNAVAILABLE`이다. 존재하지 않거나 참여 권한이 없는 가구는 같은 `403 HOUSEHOLD_ACCESS_DENIED` 응답을 받는다. 오류에는 원문 입력이나 자격 증명 대신 안정된 오류 코드와 요청 ID가 포함된다.
- 로그인한 상태에서 보호 API가 `401`을 반환하면 웹은 가구 데이터와 작성 중인 폼을 지우고 다시 로그인하도록 안내한다. `503` 또는 응답 유실로 등록 결과를 확인하지 못한 경우, 같은 로그인 세션에서 화면을 오가더라도 같은 입력으로 재제출하면 기존 요청 키를 사용한다. 이 키는 탭 메모리에만 보관한다.
- 로컬 합성 구성에서만 `POST /api/v1/sessions/local-proof`를 사용할 수 있다. 대상 모드는 합성 및 에뮬레이터 설정이 있거나 공급자 설정이 빠진 경우 시작을 거부한다.
- 제목 200자, 설명 4,000자, 담당자 100명과 32 KiB의 JSON 본문 한도를 적용한다. 제목과 설명의 원문 형식은 저장과 표시에서 유지한다.

## 대상 구성

`deploy/u1/Caddyfile.example`의 예제 주소를 대상의 비공개 네트워크 주소와 호스트명으로 바꾼다. Caddy가 해당 주소에서 HTTPS를 제공하고 API를 loopback의 Node 서버로 전달한다. Caddy 접근 로그는 활성화하지 않는다. Node는 요청 ID, 라우트 패턴, 결과 유형, 상태, 처리 시간을 기록한다. `deploy/u1/notify-me.service.example`에 서비스 계정과 systemd 구성이 있다. 대상의 프로세스 상태는 `systemctl status notify-me`와 로컬의 `http://127.0.0.1:3443/internal/health`에서 확인한다.

`NOTIFY_MODE=target`, `NOTIFY_ORIGIN`, `NOTIFY_DATABASE_PATH`, `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`를 설정한다. 두 DB 설정은 서비스 계정의 전용 저장소에 있는 동일한 SQLite 파일을 가리킨다. Firebase 자격 증명은 작업 트리 밖에서 관리한다. 운영자 전용 Tailscale의 모바일 최초 등록은 [U5 관리형 운영 설정](../deploy/u5/README.md#신규-설치의-모바일-최초-설정)을 사용한다.

대상 모드에서는 `NOTIFY_AUTH_VERIFY_TIMEOUT_MS`(기본 2,000ms, 범위 100–10,000ms)로 요청당 인증 공급자 검증 기한을, `NOTIFY_AUTH_VERIFY_RETRIES`(기본 1회, 범위 0–2회)로 일시 장애 시 앱의 재시도 횟수를 설정할 수 있다. 세션 발급에서 Firebase와 Google 검증은 같은 기한과 재시도 예산을 사용한다. 잘못된 자격 증명은 재시도 없이 거절한다. 기한이 지나면 서버는 `503 AUTH_PROVIDER_UNAVAILABLE`을 반환하고 늦게 끝난 SDK의 검증 결과를 폐기한다.

## Tailscale로 모바일 웹 접속

Pi와 폰을 같은 Tailscale 네트워크에 연결한다. Pi에서는 Node가 `127.0.0.1:3443`에서 API를 실행하고, Caddy가 `127.0.0.1:3444`에서 웹 파일을 제공하며 API를 Node에 전달한다. Tailscale Serve가 Caddy 앞에서 HTTPS를 처리한다. 라우터의 포트 포워딩 없이 같은 Tailscale 네트워크에서 접속할 수 있다.

1. Tailscale 관리 콘솔의 DNS 설정에서 **MagicDNS**와 **HTTPS Certificates**를 켠다. 인증서를 발급하면 Pi의 Tailscale 호스트명이 공개 인증서 기록에 남는다. [Tailscale HTTPS 인증서](https://tailscale.com/docs/how-to/set-up-https-certificates)
2. Firebase 콘솔에서 Google Cloud 프로젝트에 Firebase를 추가하고 웹 앱을 등록한다. **Authentication → Sign-in method → Google**을 켠다. Google Cloud의 **Google Auth Platform → Clients**에서 로그인에 사용하는 웹 클라이언트의 **Authorized JavaScript origins**에 `https://기기이름.테일넷이름.ts.net`을 추가한다. [Firebase 웹 앱 등록](https://firebase.google.com/docs/web/setup) · [Google 로그인 원본 등록](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
3. 위 [대상 구성](#대상-구성)의 환경 변수를 채운다. `NOTIFY_ORIGIN`은 Google에 등록한 HTTPS 원본과 같아야 한다. 이 절은 [U5 시스템 서비스](../deploy/u5/notify-me.service)를 기준으로 한다. 서비스 계정은 `notify-me`, 설정은 `/etc/notify-me/runtime.env`와 `/etc/notify-me/operations.env`, 상태는 `/var/lib/notify-me`에 둔다. Firebase 서비스 계정 키는 서비스 계정만 읽을 수 있는 위치에 모드 0600으로 저장한다.
4. [Caddy 설정 예제](../deploy/u1/Caddyfile.example)에서 사이트 주소를 `http://:3444`로, `bind`를 `127.0.0.1`로 바꾸고 `tls internal` 줄을 제거한다. `root`는 빌드한 릴리스의 `/opt/notify-me/dist/web`로 지정한다. `/internal/*` 차단과 API 프록시 설정을 유지하고 변경된 Caddy 설정을 설치한다. 별도 이름의 Caddy 서비스를 쓰는 경우 아래의 `caddy.service`를 그 시스템 서비스 이름으로 바꾼다.
5. 저장소 루트에서 빌드한 뒤 설치 상태에 맞는 경로를 사용한다. **신규 설치**에는 관리형 운영 상태·원장·백업 설정을 준비하고, 대상 SQLite가 아직 없는 상태에서 `prepare-new-installation`을 실행한다. 이 명령이 마이그레이션을 적용한다. **기존 설치 업그레이드**에는 검증된 백업을 확보하고 해당 서비스가 현재 사용하는 DB에 기존 마이그레이션 절차를 적용한다. 대상이 기존 설치이면 아래 신규 준비 명령을 사용하지 않는다. 설치와 Serve 구성은 운영 도구에서 한 번 준비한다. [U5 명령 및 설정](../deploy/u5/README.md#신규-설치의-모바일-최초-설정), [Tailscale Serve 명령](https://tailscale.com/docs/reference/tailscale-cli/serve).

   ```bash
   sudo systemd-run --wait --collect --pipe \
     -p User=notify-me -p Group=notify-me -p WorkingDirectory=/opt/notify-me \
     -p EnvironmentFile=/etc/notify-me/runtime.env \
     -p EnvironmentFile=/etc/notify-me/operations.env \
     /usr/bin/node /opt/notify-me/dist/server/operations-cli.js prepare-new-installation
   sudo systemctl enable --now notify-me.service caddy.service
   sudo tailscale serve --bg http://127.0.0.1:3444
   tailscale serve status
   ```

6. 폰에서 Wi-Fi를 끄고 모바일 데이터와 Tailscale을 켠다. Android Chrome에서 Serve의 HTTPS 주소를 열고 관리자 Google 계정으로 로그인한다. 화면에 표시된 계정을 확인하고 **설정 시작**을 누른다. 이후 **리마인더 추가 → 저장 → 내 할 일에서 확인**까지 진행한다. 로그인한 계정이 맞지 않으면 **취소** 뒤 원하는 계정으로 다시 시도한다. 새로고침으로 인증이 사라지면 같은 계정으로 다시 로그인한다. 창을 닫으면 최초 예약 후 10분에 후보가 만료된다. 폰에서 이 설정을 완료하는 데 PC, 개발자 도구, 토큰 복사, SSH가 필요 없다.

문제가 생기면 `curl -i http://127.0.0.1:3443/internal/health`로 API 상태를 확인한다. `curl -i http://127.0.0.1:3444/internal/health`는 Caddy가 내부 경로를 차단하므로 404를 반환해야 한다. 시스템 서비스 로그는 `sudo journalctl -u notify-me.service -u caddy.service -n 50`에서 확인한다.

## 격리 검증과 의도적인 재설정

1. 운영 중인 SQLite, 삭제 원장, 설정, 백업 위치와 보호 키·권위 볼륨을 확인한다. 재설정으로 새 운영 설치를 전환하려면 운영자 승인을 받고 현재 가구를 복구할 수 있는 백업과 설정을 확보한다. 현재 설치를 지워 시험하지 않는다.
2. 테스트나 승인된 재설정은 기존 파일을 재사용하지 않는 새 인스턴스로 준비한다. 전용 서비스 환경 파일과 상태 디렉터리, SQLite 경로, 별도 아카이브·권위 볼륨·보호 키를 사용한다. 같은 Pi에서 두 인스턴스를 동시에 운영하는 경우 API와 Caddy 포트를 각각 분리한다. 현행 Chrome의 운영 세션 쿠키와 섞이지 않도록 실제 테스트에는 다른 호스트명의 Tailscale HTTPS 주소와 비운영 Firebase 프로젝트·Google 테스트 계정을 사용한다. Google OAuth 원본과 `NOTIFY_ORIGIN`에 테스트 주소를 그대로 등록한다.
3. 새 인스턴스에만 `NOTIFY_SETUP_INGRESS=tailnet-operator-only`를 지정한다. Tailscale 정책에서 해당 주소에 운영자만 도달하는지 확인하고 Funnel이 꺼져 있는지 점검한다. 그 인스턴스의 서비스 계정과 환경을 적용한 뒤, 경로가 새 상태 디렉터리의 아직 존재하지 않는 `.sqlite` 파일인지 확인한다. 앞 절의 준비·기동 명령을 해당 서비스 이름과 포트에 맞춰 실행한다.
4. 폰의 Wi-Fi를 끄고 모바일 데이터·Tailscale을 켠다. 먼저 취소를 검증한 뒤 같은 계정으로 다시 로그인해 **설정 시작**을 누른다. 예를 들어 제목이 `최초 설정 검증`인 리마인더를 저장하고 목록에서 조회한다. 성공 응답이 끊겼으면 같은 계정으로 다시 로그인해 기존 가구가 유지되는지 확인한다. 근거에는 버전, 환경, 시각, 성공 여부만 남기고 Google 이메일·토큰·운영 호스트명은 기록하지 않는다.
5. 기존 설치를 대체하기로 승인한 경우 확인이 끝난 새 인스턴스에만 주소를 전환한다. 롤백은 기존 서비스 설정·주소·기존 데이터를 다시 연결한다. 선택한 정상 백업을 복원하거나 가구를 종료하는 작업은 최초 관리자 설정을 열지 않는다. 설치 기록이 불명확하면 로그와 활성 DB·운영 상태를 점검하고 [관리형 복구 절차](../deploy/u5/README.md#격리-복구)를 따른다.

## 검증

`npm exec -- playwright install --with-deps chromium`으로 브라우저 환경을 준비하고 `npm run verify:u1`로 타입 검사, 빌드, 라인 커버리지 80% 검사와 브라우저 종단 검증을 실행한다. GitHub Actions에서는 `.github/workflows/u1-app-ci.yml`이 같은 명령을 사용한다.

실제 비운영 Google·Firebase 로그인은 승인된 테스트 자격이 준비되면 별도로 확인한다. 개발 호스트의 검증 결과와 대상 Raspberry Pi 환경의 검증 결과는 별도로 기록한다.

승인된 U1 인프라 설계 검토의 자동 추적 검사 결과는 FAIL이다. 검사기가 이전 NFR 설계의 입력 식별자를 인식하지 못했다. 당시 리뷰는 인프라 설계표의 12개 연결을 수동 대조했다. 자동 검사 결과와 수동 대조는 `infrastructure-design/reviews/review-01.md`에 기록되어 있다.
