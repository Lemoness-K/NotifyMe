# ADR-004: MVP Google 로그인과 내부 사용자 ID

- 상태: 승인
- 작성일: 2026-11-04
- 승인일: 2026-11-04
- 관련 결정: `D-024`
- 관련 요구사항: `F-ACC-001`~`F-ACC-006`, `PR-AC-029`~`PR-AC-030`

## 배경

MVP는 두 사람이 인터넷을 통해 Raspberry Pi 서버에 접속한다. 자체 ID/비밀번호를 받으면
비밀번호 hash, 로그인 공격 방어, 계정 복구·메일 발송을 직접 운영해야 한다. Google 소셜
로그인이나 관리형 인증은 사용자가 이미 가진 계정을 활용해 이 부담을 줄일 수 있다. 한편
Reminder, Membership와 완료 기록은 특정 로그인 사업자에 종속되어서는 안 된다.

인증 옵션과 2026-11-04 기준 공개 요금은 [보안·개인정보 설계](../07-security-and-privacy.md#21-인증-방식과-비용-선택지)에 정리한다.

## 결정

1. MVP 로그인은 Firebase Authentication의 Google provider만 사용한다.
2. 앱은 내부 사용자명·비밀번호를 만들거나 로그인 입력으로 받지 않는다. 내부 `User.id`는
   서비스가 생성하는 불변 식별자이며 로그인 자격이 아니다.
3. Firebase identity issuer와 UID(subject)를 내부 `User.id`에 연결하는 `AuthIdentity`를 둔다.
   Google email은 표시·연락 정보로 취급하며 primary key나 자동 계정 병합 키로 사용하지 않는다.
4. Android/Web 클라이언트는 Firebase ID token을 RPi API에 제시한다. API는 token 서명,
   issuer, audience, 만료를 검증한 뒤 내부 User를 확인한다. Reminder와 Household 권한은
   `User.id`와 자체 `Membership`에서 검사한다.
5. Firebase provider claim에 household role을 저장하거나 이를 권한 판단에 사용하지 않는다.
6. 상용화 시 Apple, 자체 이메일·비밀번호 또는 기업용 SSO를 추가할지는 별도 결정으로 남긴다(`Q-030`).

## 고려한 대안

### RPi에서 자체 ID/비밀번호 관리

- 장점: 인증 데이터와 운영을 자체 통제하고 외부 인증 서비스 의존성을 피한다.
- 보류 이유: 비밀번호 보호, 복구, abuse 대응과 이메일 발송 운영을 MVP에서 직접 맡아야 한다.

### Google OIDC 직접 연동

- 장점: 별도의 managed authentication 제품 없이 Google 로그인을 구현할 수 있다.
- 보류 이유: Android/Web client별 OAuth 흐름, token 검증, session과 계정 연결을 직접 구현해야
  한다. 관리형 Firebase Auth가 MVP에서 구현 부담을 더 줄인다.

### Auth0 등 상용 관리형 인증

- 장점: 여러 로그인 방식과 관리 UI를 제공하고 향후 기업 SSO를 추가하기 편하다.
- 보류 이유: 현재 가구 규모에는 필요한 기능보다 크며, 추가 업체 의존성을 만들 필요가 없다.
  무료 tier와 기능 한도는 바뀔 수 있다.

## 결과

### 긍정적

- 앱이 비밀번호 원문이나 hash를 보유하지 않고 비밀번호 복구 흐름도 구현하지 않는다.
- 내부 User·Membership·Reminder ID는 인증 사업자와 분리되어 가구 권한을 자체 관리한다.
- 향후 provider를 추가해도 기존 업무 데이터와 완료 이력을 유지할 수 있다.

### 비용과 위험

- Firebase Authentication과 Google 계정의 가용성·정책 변경에 로그인 가능성이 의존한다.
- Firebase identity metadata는 Google에 저장되며 API는 signing key와 token 정책을 검증해야 한다.
- 사용자는 Google 계정이 있어야 하고 Google 계정 복구에 접근할 수 있어야 한다.
- Google provider만으로는 Google 계정이 없는 상용 서비스 이용자를 지원하지 않는다.

## 검증 조건

- 사용자가 Google provider로 인증하고 Firebase ID token을 발급받는다.
- RPi API가 유효하지 않거나 audience/issuer가 다른 token을 거부한다.
- Firebase UID가 내부 `User.id`에 매핑되고 household role은 `Membership`에서 확인한다.
- 클라이언트 로그인 UI에 내부 User ID와 내부 비밀번호 입력란이 없다.
- 같은 Google identity의 재로그인은 기존 내부 User와 업무 데이터를 유지한다.
