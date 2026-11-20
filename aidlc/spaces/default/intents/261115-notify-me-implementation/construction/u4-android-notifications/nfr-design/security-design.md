# U4 security-design

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

- NFR1.1.4, NFR1.2.4, NFR1.3.4. 설치·가구·epoch를 읽기, 이벤트, 제외의 권한과 작업 키에 묶는다. 설치 등록·세션에 필요한 Google 증명은 Credential Manager에 서버 challenge nonce와 기존 서버 OAuth client ID를 사용하고 Firebase ID token과 함께 기존 U1 발급 경로에서 검증한다. 네이티브 HTTP는 승인된 HTTPS API 호스트와 명시한 route만 호출한다. WebView 브리지는 번들된 UI와 허용된 API 입력만 받고 원격 탐색은 시스템 브라우저로 분리한다. 기기에서 쿠키·자격 증명을 JavaScript나 URL에 넘기지 않는다. 외부 origin·잘못된 nonce·오래된 epoch·다른 설치·세션 회수, 웹 인증 회귀를 자동 검증한다.
- NFR1.4.4. KeyStore 기반의 OS 보호 저장소 키로 자격을 보호한다. 민감 파일을 Android 백업에서 제외하고 계정 전환·로그아웃 시 자격을 제거한다. FCM 등록 토큰은 인증된 고정 HTTPS 경로로 보내고, 서버의 암호화된 토큰 값과 운영 키는 분리한다.
- NFR2.1.4, NFR2.2.4, NFR2.3.4. 변경 신호와 이벤트에서 제목·위치·토큰을 제외한다. 공개 알림은 계정 언어의 일반 문구다. 30일 만료·삭제와 설치 제거를 검증한다.
- [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [Firebase Android Google 로그인](https://firebase.google.com/docs/auth/android/google-signin)
