# 보안과 개인정보 설계

- 상태: 초안
- 최근 갱신일: 2026-11-09
- 관련 결정: `D-010`, `D-011`, `D-019`~`D-044`, `D-057`~`D-060`, `D-068`
- 관련 요구사항: `PR-AC-025`~`PR-AC-036`, `PR-AC-045`, `PR-AC-053`~`PR-AC-054`, `NFR-SEC-001`~`NFR-SEC-006`, `NFR-REL-007`
- 관련 문서: [마스터 설계](./00-master-design.md), [제품 요구사항](./01-product-requirements.md), [도메인·데이터 설계](./02-domain-and-data-design.md), [시스템 아키텍처](./03-system-architecture.md)

## 1. 목표와 위협 경계

MVP 서버는 인터넷에서 접속할 수 있으므로 household 자료, 로그인 세션, 초대 링크, 위치 설정을
보호한다. 현재 위협 모델은 원격 네트워크와 웹/API 접근이며, 물리적 기기 탈취와 오프라인
저장장치 열람은 범위에서 제외한다(`D-025`). 정전·재부팅 뒤 사람의 수동 key 입력 없이 서버가
자동 시작되어야 한다. 사용자가 household에 가입했다는 사실만으로 다른 household 데이터에
접근할 수 없어야 하며, 접근 검사는 서버에서 수행한다.

MVP 운영 household는 하나지만, 이후 여러 household를 지원할 때도 `household_id`가 권한과
데이터 격리의 기준으로 유지된다(`D-022`).

## 2. 인증과 권한

- 각 구성원은 Google 계정으로 Firebase Authentication에 로그인한다(`D-024`). MVP는 내부
  ID/비밀번호 로그인과 자체 비밀번호 저장을 제공하지 않는다.
- Firebase ID token을 RPi API에서 검증하고, 검증된 Firebase identity를 내부 `User.id`에
  연결한다. 내부 ID는 로그인 이름·비밀번호가 아니며 사용자에게 로그인 자격으로 받지 않는다.
- 모든 요청에서 사용자 상태, 활성 `Membership`, 대상 `household_id`를 검증한다.
- 두 역할은 reminder 업무를 동일하게 사용할 수 있다. household settings와 구성원 관리는
  활성 `ADMIN`만 수행한다(`D-010`, `D-020`).
- 활성 household에는 Admin이 최소 한 명 있어야 한다. 마지막 Admin의 강등·퇴장은 다른 Admin
  승격과 같은 transaction에서 처리한다(`D-021`).
- 로그인 세션과 invite token은 서로 다른 목적으로 발급하고 서로 대체할 수 없게 한다.

### 2.1 인증 방식과 비용 선택지

| 방식 | MVP에 드는 현금 비용 | 우리가 맡는 일 / 제약 |
|---|---|---|
| RPi 자체 ID·비밀번호 | 별도 인증 사업자 요금 없음. 비밀번호 재설정 이메일을 보내면 메일 발송 비용·운영이 추가될 수 있다. | 비밀번호 hash, rate limit, reset/recovery, 세션 보안, 유출 대응을 직접 운영한다. |
| Google 로그인 직접 연동 | Google Identity Services 문서는 OAuth client 설정을 요구하지만 로그인 MAU 요금표는 싣지 않는다. **직접 소셜 로그인의 별도 사용자 요금은 없다고 보는 추론**이며, managed Identity Platform 요금과는 구분한다. | 사용자는 Google 계정이 필요하다. OAuth 설정, ID token 검증, 계정 연결과 내부 session은 앱이 구현한다. |
| Firebase Authentication / Identity Platform | 기본 Firebase Auth의 Spark 무료 요금제는 대부분 sign-in provider에 일 3,000 DAU 제한을 둔다. Identity Platform의 Blaze 요금은 social/email Tier 1 월 5만 MAU까지 무료이고 다음 구간은 $0.0055/MAU부터다. 기업용 OIDC/SAML Tier 2는 50 MAU까지 무료, 이후 $0.015/MAU다. | 인증 상태를 Google 서비스에 맡겨 비밀번호 복구 구현을 줄인다. RPi API는 token을 검증해야 하고, 인증 서비스에 대한 외부 의존성이 생긴다. 전화번호 인증은 SMS 과금이 별도다. |
| Auth0 같은 관리형 인증 서비스 | Auth0 공식 요금표는 현재 Free에서 최대 25,000 MAU를 표시한다. 상용 단계의 기능·사용량 요금은 출시 전 재확인한다. | 설정은 간편하지만 계정 정보와 인증 가용성을 업체에 의존한다. 무료 요금제 한도·기능이 바뀔 수 있다. |

Google 로그인은 개인 Google 계정으로 인증하는 social login이다. 회사가 사용자 단말·조직 로그인을
관리하는 Google Workspace/Entra/Okta 기반 SAML/OIDC SSO와는 다르다. 후자는 household 앱에
필요하지 않고 조직별 요금이 붙을 수 있다. Google Identity Platform은 외부 IdP 연동을 social
provider와 다른 가격 tier로 분류한다.

가격 근거(2026-11-04 확인): [Google Identity Services OIDC 설정](https://developers.google.com/identity/openid-connect/openid-connect), [Google Identity Platform 요금](https://cloud.google.com/identity-platform/pricing), [Google의 provider 가격 tier 설명](https://docs.cloud.google.com/identity-platform/docs/multi-tenancy-billing), [Firebase Authentication 기능·요금](https://firebase.google.com/docs/auth), [Auth0 요금](https://auth0.com/pricing).

**선택한 MVP 방식:** Firebase Authentication의 Google provider로 로그인하고, 내부 User ID와
household 권한·업무 데이터는 RPi DB가 관리한다(`D-024`). 두 구성원이 사용하는 Google 계정을
인증 자격으로 쓰며 앱 자체의 사용자명/비밀번호는 만들지 않는다. 로그인 복구는 Google 계정
복구 경로에 의존한다. Firebase는 provider identity와 인증 상태를 처리하고 RPi는 Firebase ID
token을 확인한 뒤 자체 Membership 권한을 검사한다.

이 선택은 비밀번호 저장·복구 부담을 줄이고 현재 무료 구간 안에서 동작할 가능성이 높다. 다만
identity 정보와 로그인 가능성이 외부 인증 서비스에 의존한다. 상용화 때 Google 외 로그인이나
자체 비밀번호를 추가할지는 `Q-030`에서 결정한다.

### 2.2 API와 웹 공격 방어

- 모든 API 요청에서 Firebase ID token의 서명, issuer, audience, 만료를 검증한다. 클라이언트가
  보낸 `household_id`, 역할, 소유자 값을 권한 근거로 삼지 않는다.
- 모든 요청에서 사용자 상태, 활성 Membership, 요청 대상 객체의 `household_id`와 역할 권한을
  검사한다. 각 객체와 기능에 대해 서버가 인가를 결정한다. UI에서 버튼을 감추는 것은 권한 검사를
  대신하지 않는다.
- Admin이 구성원을 제거하면 Membership를 비활성화하고 다음 API 요청부터 해당 household 접근을 거부한다.
  서버는 그 구성원을 활성 Assignment와 해당 household의 ChangeSignal/알림 대상으로 즉시 제외한다.
  연결 기기는 권한 회수 신호를 받거나 다음 API 접근 거부를 확인할 때 해당 household 캐시·로컬 예약·geofence를
  삭제한다. FCM 전달은 best-effort이며 force-stop 중에는 삭제 신호와 로컬 정리를 보장하지 않는다(`D-050`, `D-059`).
  로그아웃·계정 비활성화·기기 분실은 별도 세션·DeviceInstallation 취소 흐름으로 처리한다.
- 요청 본문은 크기와 형식을 제한하고 schema validation을 적용한다. DB 질의는 parameterized
  query/안전한 ORM을 사용하고, 사용자 입력을 HTML로 표시할 때는 문맥에 맞게 출력 인코딩한다.
- 브라우저 인증이 cookie 기반이면 상태 변경 요청에 CSRF 방어와 `Secure`, `HttpOnly`, 적절한
  `SameSite` 속성을 적용한다. bearer token 기반이면 token을 URL·로그에 넣지 않고 Android와 웹
  클라이언트에서 안전하게 보관한다. CORS는 실제 앱 origin만 허용한다.
- 상태를 바꾸는 작업은 `GET`으로 노출하지 않는다. 인증, 초대 생성·수락 등 악용되기 쉬운 endpoint에
  요청 제한을 둔다.
- 오류 응답은 내부 stack trace, DB 정보, household 존재 여부, 초대 상태 세부정보를 불필요하게
  노출하지 않는다. 관리용 endpoint와 DB port는 공개하지 않는다.
- HTTPS를 필수로 하고 운영 domain이 정해진 뒤 보안 response header와 인증서 자동 갱신을
  구성한다. 서비스와 dependency 보안 업데이트 절차를 운영한다.

### 2.3 외부 진입점

- Caddy를 유일한 공개 ingress로 사용해 HTTPS를 종료하고 HTTP를 HTTPS로 redirect한다. Caddy는 React 정적 build를 제공하고 API 요청을 내부 NestJS 서비스로 reverse proxy한다(`D-057`).
- DDNS hostname과 DNS 도달성을 배포 시 확인한다. Caddy의 자동 인증서 발급·갱신에는 외부에서 TCP 80/443이 RPi의 Caddy에 도달해야 한다.
- 라우터에서 TCP 80/443만 Caddy로 전달한다. NestJS, DB, SSH와 다른 관리 포트는 인터넷에 직접 공개하지 않는다. 실제 port forwarding 및 방화벽 변경은 배포 운영 단계에서 수행한다.
- Caddy의 인증서와 설정 저장 경로는 영속 저장소에 두고, 인증서 관련 비밀을 저장소·로그·문서에 기록하지 않는다.

## 3. 초대 URL

### 3.1 발급과 보관

- 활성 Admin만 초대를 생성하고 취소할 수 있다.
- 초대 코드는 CSPRNG로 만든 예측 불가능한 secret(최소 128 bit entropy 권장)이다. URL token만으로는 가입할 수
  없으며, 지정된 대상 Google 계정 인증도 함께 요구한다. household ID나 순차 숫자를 초대 권한으로 사용하지 않는다.
- URL을 생성할 때만 원문 코드를 보여준다. 서버는 코드의 단방향 hash와 household, 생성자,
  대상 Google 이메일, 만료·사용·취소 시각을 저장한다(`D-023`, `D-029`). 대상 이메일은 대기 중인 초대에만
  보관하고 초대가 수락·취소·만료되면 삭제한다.
- MVP는 초대 URL을 복사해 메신저 등으로 직접 공유한다. 서버가 이메일을 보내지 않는다.
- 링크를 소유한 사람은 초대 대상과 일치하는 Google 계정으로 인증해야 가입할 수 있다. Admin은 그래도 링크를
  의도한 상대에게 전달해야 한다. 일회용 사용, 24시간 만료, Admin 취소로 노출 시간을 제한한다(`D-028`, `D-029`).

### 3.2 수락 흐름

1. 링크를 열면 가입 또는 로그인 화면으로 이동한다. 이 단계에서는 household 정보를 필요한
   최소 범위만 표시한다.
2. 새 사용자는 계정을 만들고 기존 사용자는 로그인한다. URL 코드를 별도 입력하지 않는다.
3. 인증된 사용자가 가입을 확정하면 서버가 Firebase ID token을 검증하고, Google provider 사용,
   `email_verified=true`, 초대 대상 이메일 일치를 확인한다. 이 조건을 만족하면 초대 소비와
   `MEMBER` Membership 생성을 하나의 transaction에서 수행한다(`D-027`, `D-029`). Admin 역할은
   별도 권한 변경으로만 부여한다.
4. 만료·취소·이미 소비된 링크는 가입을 거부하고 다시 Admin에게 새 초대를 요청하도록 안내한다.
   이메일 불일치도 같은 일반 오류로 거부하고 초대를 소비하지 않는다.
5. 코드 GET 조회만으로는 초대를 소비하거나 Membership를 만들지 않는다. 링크 검사 봇이나
   브라우저 prefetch가 초대를 소모하지 않게 가입 처리는 인증 뒤의 명시적 POST 요청으로 한다.

초대 링크 수락 시 항상 Member Membership를 생성하고, Admin 승격은 기존 Admin의 별도 관리 작업으로 한다(`D-027`).
초대는 발급 후 24시간 유효하며 지정된 Google 계정의 확인된 이메일과 일치해야 한다(`D-028`, `D-029`).

### 3.3 URL 비밀값 누출 방지

- 초대 링크는 HTTPS에서만 연다.
- 웹/API·reverse proxy 접근 로그와 오류 보고에서 초대 코드가 포함된 URL 경로를 기록하지
  않도록 마스킹한다. 분석용 제3자 스크립트를 초대 landing 화면에 로드하지 않는다.
- landing 화면은 `Referrer-Policy: no-referrer`를 적용하고 코드를 처리한 뒤 브라우저 주소에서
  제거하거나, 코드가 서버에 전달되지 않는 URL fragment 기반 흐름을 사용한다.
- 초대 생성 결과는 한 번만 노출하고, 별도의 초대 관리 화면에서는 원문 링크를 다시 읽어낼 수
  없게 한다. Admin은 초대의 만료, 사용, 취소 상태만 확인한다.
- 초대 검증 endpoint에는 요청 제한을 적용하고 유효성 응답에서 가구의 민감한 정보를 노출하지 않는다.

## 4. 저장 데이터 분류와 보호

| 데이터 범주 | 예시 | 저장 보호 기준 |
|---|---|---|
| 가구 업무 데이터 | Reminder 제목·내용, 담당자, 반복 규칙, 완료·감사 이력 | 개인·가족 정보로 취급한다. SQLite를 인터넷에 노출하지 않고 API에서 household별 접근 검사를 한다. 별도 보관 백업은 암호화한다. DB 저장 암호화는 SQLite의 적용 방식과 위협에 따라 선택한다(`D-053`). |
| 위치 설정 | 장소 이름, 좌표, 반경, geofence event 상태 | 업무상 필요한 좌표만 저장하고 연속 현재 위치 이력은 만들지 않는다. household 권한으로 제한하고 로그·감사 payload에 복제하지 않는다. |
| 계정 연결 정보 | 내부 `User.id`, Firebase issuer/UID, 필요한 경우 표시 이름 | 비밀번호는 보관하지 않는다. 이메일이나 provider token을 업무 데이터 식별자로 사용하지 않고 필요한 claim만 저장한다. |
| 기기·초대 비밀 | FCM push token, invite token, 초대 대상 이메일, Firebase service credential, 세션 signing key | invite token은 hash로 저장한다. 초대 대상 이메일은 pending invitation 동안만 보관한다. push token 등 재사용 가능한 credential은 최소 접근으로 제한하고 필요하면 DB 밖의 암호문 또는 OS secret store로 보호한다. 원문을 로그에 남기지 않는다. |
| 운영 자료 | DB dump, 환경 설정, 오류 로그, 백업 | DB와 비밀값은 서비스 계정만 접근하게 한다. 별도 위치에 보관하는 백업은 암호화한다. 로그에는 payload, token, credential, 정확한 위치를 넣지 않는다. |

### 저장 암호화와 key 관리

- 운영 SQLite 파일의 저장 암호화는 현재 위협 모델에서 웹/API 공격을 막는 통제로 간주하지 않는다. 적용 여부는 실제 보호 목적과 SQLite 지원 방식, 자동 재시작 요구를 함께 검토해 정한다(`D-025`, `D-053`).
- 별도 파일·장치·서비스에 보관하는 백업은 저장 시 암호화한다(`NFR-SEC-006`). 백업 key는 백업 본체와 분리해 제한된 관리자만 복구할 수 있게 하며, 복구 절차를 실제로 확인한다.
- 전체 디스크 암호화는 물리적 저장장치 탈취 위협을 대상으로 하므로 MVP 필수 범위에서 제외한다(`D-025`). DB나 백업 암호화를 적용해도 온라인 서버가 침해된 동안의 데이터 노출은 별도로 막지 못한다.
- 직접 암호 알고리즘을 만들지 않는다. 암호화 적용 시 유지보수되는 OS·DB·언어 라이브러리를 사용하고, key 생성·접근·교체·복구 절차를 함께 설계한다.

### key와 DB 접근 제한

- Firebase service account key, FCM key, DB password, signing key를 source control에 저장하지 않는다. 환경에 둘 경우 root/서비스 계정만 읽을 수 있는 별도 credential 파일이나 OS secret mechanism을 사용한다.
- API의 DB 계정은 runtime에 필요한 table·operation만 허용한다. schema migration은 별도 계정/절차로 실행하고 앱 process를 root로 구동하지 않는다.
- DB, token, encryption key가 포함된 파일에는 최소 파일 권한을 적용한다. 저장장치 교체·폐기 전 안전한 wipe 또는 암호화 key 폐기 절차를 둔다.

## 5. 가구 데이터와 개인정보

- 모든 household 소유 자료와 관련 query는 `household_id` 범위 안에서 처리한다. 자식 데이터의
  부모 관계에도 같은 household ID인지 검증한다.
- 장소 Trigger에는 사용자가 설정한 장소의 좌표와 반경이 필요하다. 설계 원칙은 상시 기기 위치를
  서버로 보내지 않고 앱 데이터에도 사용자 실시간 좌표·경로를 저장하지 않는다. geofence 판단은
  Android/iOS 어댑터에서 처리한다. 사용자가 지정한 장소 좌표는 Reminder Trigger 설정으로 저장하고,
  event metadata는 좌표 없이 서버에 30일 보관한다(`D-043`). 백그라운드 위치 권한과 기능 상태는
  설치별로 관리하고, 권한이 없어도 Reminder 저장을 허용한다. 해당 설치에만 알림 불가 상태와 OS 설정
  바로가기를 보이며 권한 회복 시 지오펜스를 재등록한다(`D-044`). 조건 감지 뒤 즉시 로컬 알림을
  표시하며 서버 동기화를 기다리지 않는다(`D-042`).
- 운영 로그에서 비밀번호, 세션·초대 token, 정확한 현재 위치, reminder 본문을 제외하거나 가린다. 제품 변경 이력의 본문 변경 값은 가구 권한으로 보호하는 별도 업무 데이터다.
- 사용자가 조회하는 Reminder 변경 이력은 household 권한으로 보호하는 업무 데이터이며, 운영 로그와 분리한다. 주요 필드의 변경 전·후 값을 기록하되 정확한 위치 좌표는 이력 payload에서 제외한다(`D-037`). Admin이 반경 범위를 바꿔 Trigger를 자동 조정한 경우에도 해당 Admin을 행위자로 기록한다(`D-040`).
- 완료·놓침·건너뛴 회차 이력은 명시적 영구 삭제가 적용되는 경우를 제외하고 연령 기반 자동 삭제 없이 계속 보존한다(`D-031`, `D-075`). 보관 Reminder의 설정과 회차 이력은 유지한다. Reminder 영구 삭제는 사용자 화면과 운영 DB에서 즉시 효력을 갖고, 기기 동기화용 최소 tombstone과 암호화된 복구 백업은 최대 30일 보관한다(`D-032`, `D-058`). 계정 삭제는 직접 식별 정보·인증 연결을 제거하고 공유 이력의 actor 참조를 비식별 처리하며, 가구 종료는 Admin이 다른 구성원이 있어도 명시적 확인 후 실행할 수 있고 해당 가구 데이터를 제거한다(`D-068`). 계정·가구 tombstone을 백업 복원 전에 재적용해 삭제 데이터가 되살아나지 않게 한다. 삭제 화면에는 백업 보관 세부사항을 표시하지 않지만, 서비스 출시 시 개인정보 처리방침에 보관·파기 방식을 공개한다. 데이터 모델은 후속 내보내기를 고려하지만 MVP에는 내보내기를 제공하지 않는다(`D-067`).
- 계정 삭제는 서버에서 먼저 접근을 차단한 뒤 외부 인증 삭제와 개인 정보 정리를 재시도 가능하게 완료한다. 가구 종료는 모든 구성원의 API 접근·초대를 즉시 차단하고 공유 데이터와 미전달 작업을 제거한다. 종료에 다른 구성원의 동의는 요구하지 않으며, 구성원 기기 알림은 best-effort다. Reminder의 다른 담당자와 알림은 계정 삭제 대상자의 담당 관계만 제거하고 계속 유지한다(`D-059`, `D-060`, `D-068`).
- 계정·가구 삭제와 공유 이력 비식별화, Firebase·FCM 및 운영 백업의 실제 보유·파기 방식은 개인정보 보호법상 파기·삭제 요구와 함께 상용 공개 전에 검토한다. 30일 백업·tombstone 정책 자체가 법률 적합성을 보장한다고 간주하지 않는다([제21조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078981), [제36조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335317)).
- FCM push token은 기기 식별 비밀로 취급한다. ChangeSignal payload에는 revision과 필요한 entity ID만 넣고 알림 본문·장소 좌표를 포함하지 않는다(`D-043`, `D-046`).
  Android OS가 잠금 화면 노출을 최종 결정하며, 앱은 민감 알림에 `VISIBILITY_PRIVATE`와 일반화된 `publicVersion`을
  사용한다. 앱은 Android 알림 설정 화면으로 안내한다(`D-026`).

## 6. 네트워크와 운영

- 공개 API는 HTTPS만 허용한다. DB 및 관리 포트는 인터넷에 직접 공개하지 않는다(`D-011`).
- 로그인, 초대 발급·수락과 계정·구성원 변경 요청에 속도 제한과 감사 이벤트를 적용한다. 로그는 비밀값과
  reminder 본문, 정확한 위치를 제외하고 보안상 필요한 권한 변경·초대·실패 이벤트만 기록한다.
- 비밀값은 환경 변수 또는 비밀 저장소에서 공급하고 로그와 문서에 넣지 않는다.
- 백업에는 household 업무 데이터와 계정 연결 정보가 포함된다. 별도 보관 백업은 암호화하고 접근을 제한하며 최대 30일 순환 보관한다. 복구 key 관리와 Reminder·계정·가구 tombstone 재적용을 포함한 실제 복원 절차를 둔다(`NFR-SEC-006`, `D-058`, `D-068`).
- RPi 운영체제, reverse proxy, 애플리케이션과 dependency에 보안 업데이트를 적용하고, 공개 전 production 설정에서
  debug mode·sample credential·관리 port가 비활성인지 확인한다.
- 의존성의 보안 업데이트와 공개 전 설정 검토는 [배포·운영 설계](./06-deployment-and-operations.md)에서 다룬다.

## 7. 결정 대기 항목

인증 제공자 관련 열린 질문의 상태는 [사용자 결정 및 질문 등록부](./decision-register.md)에서 관리한다. MVP는 Google provider를 사용하고 인증 경계는 `IdentityProvider` port로 유지한다(`D-024`).

## 8. 공식 보안 지침

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html): 위협 모델, 민감 데이터 최소 저장, 암호화 계층과 key 분리·회전
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html): key 생성·보관·복구·폐기와 암호화 데이터의 key backup
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): 비밀번호, access token, key와 민감정보를 로그에 기록하지 않기
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): 모든 요청·대상 객체에 대한 서버측 권한 검사
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html): HTTPS, endpoint 보호, 보안 response header, 요청 제한
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): cookie 기반 브라우저 세션의 상태 변경 요청 보호
- [Firebase ID token 검증](https://firebase.google.com/docs/auth/admin/verify-id-tokens): 클라이언트 token을 HTTPS로 서버에 보내고 Admin SDK에서 검증
- [Firebase ID token claim reference](https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken): `email_verified` claim
- [Firebase 세션 관리](https://firebase.google.com/docs/auth/admin/manage-sessions): refresh token 취소와 서버의 token revocation 검사
- [Android 알림 표시 수준](https://developer.android.com/develop/ui/compose/notifications/create-notification#lockscreenNotification): `PUBLIC`, `PRIVATE`, `SECRET`, 가린 `publicVersion`, OS 사용자 제어
- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final): cryptographic key 수명주기와 보호
