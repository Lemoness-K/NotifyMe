# ADR-025: DDNS 외부 진입점으로 Caddy 자동 HTTPS 사용

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-011`, `D-054`, `D-055`, `D-057`
- 해결한 질문: `Q-017`
- 관련 요구사항: `F-OPS-001`, `F-OPS-002`, `F-CLI-004`, `PR-AC-007`, `PR-AC-044`, `NFR-SEC-003`, `NFR-SEC-005`
- 관련 문서: [마스터 설계](../00-master-design.md), [시스템 아키텍처](../03-system-architecture.md), [배포·운영](../06-deployment-and-operations.md), [보안·개인정보](../07-security-and-privacy.md)

## 맥락

MVP는 외부 네트워크에서도 Raspberry Pi 서비스에 상시 HTTPS 접속한다고 가정한다(`D-011`).
사용자는 서비스가 안정된 뒤 DDNS와 라우터 포트 포워딩으로 외부 공개를 진행할 계획이다.
Web UI는 브라우저용 정적 build와 Capacitor 내장 asset을 공유하며, API는 NestJS에서 제공한다
(`D-054`, `D-055`).

Caddy는 hostname이 설정된 사이트에 대해 HTTPS를 자동 활성화하고, 공개 DNS가 서버를 가리키며
외부 80/443 포트가 도달 가능하면 공개 TLS 인증서를 발급·갱신하고 HTTP를 HTTPS로 전환한다.
또한 정적 파일 서버와 reverse proxy를 제공한다([Caddy HTTPS 안내](https://caddyserver.com/docs/quick-starts/https),
[Caddy reverse proxy 안내](https://caddyserver.com/docs/quick-starts/reverse-proxy),
[Caddy 자동 HTTPS](https://caddyserver.com/docs/automatic-https)).

## 결정

- DDNS가 제공하는 공개 hostname 하나를 외부 브라우저와 앱의 서비스 주소로 사용한다. 정확한 DDNS 제공자와 hostname은 배포 설정에서 고른다.
- Raspberry Pi의 공개 진입점에는 Caddy를 reverse proxy와 TLS 종료점으로 둔다(`D-057`).
- Caddy가 브라우저용 React/Vite 정적 build를 제공하고 API 요청은 로컬 NestJS upstream으로 전달한다. Capacitor 앱은 포함한 Web UI build를 사용하고 동일한 hostname의 HTTPS API에 연결한다.
- Caddy의 자동 HTTPS를 사용하고 HTTP 요청은 HTTPS로 redirect한다. 공개 HTTP challenge와 redirect를 위해 라우터의 TCP 80과 443을 Caddy에 전달한다.
- NestJS API와 DB는 외부에 직접 노출하지 않는다. API는 loopback 또는 내부 전용 listen address에 두고 Caddy를 통해서만 접근한다.
- Caddy의 인증서 자동 갱신에 필요한 data/config 경로는 RPi의 영속 경로에 두고 서비스 계정만 접근하게 한다.
- DDNS DNS record가 현재 공인 주소를 가리키는지와 외부 80/443 도달성을 배포 시 검증한다. 실제 포트 포워딩·방화벽 수정은 별도 운영 작업이며 이 결정으로 실행하지 않는다.

## 결과

### 장점

- React static hosting, HTTPS 인증서 관리와 API proxy를 단일 ingress에서 제공한다.
- 인증서 발급과 갱신을 앱 코드와 분리하고 수동 인증서 교체 작업을 줄인다.
- 클라이언트는 하나의 안정된 HTTPS hostname을 사용한다.

### 고려할 점

- Caddy의 인증서 자동화에는 hostname DNS와 외부 port 도달성이 필요하다. 집 인터넷 환경에서 공인 inbound 연결이 되지 않으면 DDNS만으로 해결되지 않으므로 대체 ingress를 재검토한다.
- 포트 80/443은 Caddy에만 전달하고 NestJS·DB·관리 포트는 외부에 공개하지 않는다.
- 정적 UI·API 경로와 SPA fallback 설정은 배포 설정 및 브라우저/Capacitor 실기기 검증에서 확정한다.

## 고려한 대안

- **Nginx + 별도 ACME client**: 유연하고 널리 쓰이지만 인증서 발급·갱신 client와 reverse proxy 설정을 따로 운영해야 한다.
- **수동 인증서 관리**: 추가 자동화 도구를 줄일 수 있지만 발급·갱신·배포 실패를 직접 관리해야 한다.
- **직접 NestJS 공개**: TLS 종료와 정적 asset hosting을 앱에 합치게 되므로 공개 ingress와 애플리케이션을 분리하는 선택보다 운영 경계가 약해진다.

## 재검토 조건

DDNS provider의 DNS update 지원, 인터넷 서비스 제공자의 inbound port 제한, CGNAT, 또는
RPi 장애 대응 요구가 설계 전제와 맞지 않으면 tunnel·managed reverse proxy·외부 host를
비교해 ingress를 재검토한다.
