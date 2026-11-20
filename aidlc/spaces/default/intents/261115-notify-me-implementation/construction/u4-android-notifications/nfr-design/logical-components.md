# U4 logical-components

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

| 구성 요소 | 책임 |
| --- | --- |
| 공유 WebView/브라우저 | NFR6.1.4, NFR6.2.4, NFR6.3.4, NFR6.4.4. 업무 흐름과 설치 설정을 반응형으로 제공한다. 확인 안내 및 OS 상태는 기존 UI 패턴을 따른다. |
| 현지화 | NFR7.1.4, NFR7.2.4, NFR7.3.4, NFR7.4.4, NFR7.5.4. ko-KR/en-US 리소스와 기존 locale 우선순위를 재사용한다. |
| 서버·기기 어댑터 | NFR8.1.4, NFR8.2.4. 공유 타입 포트와 Capacitor Kotlin 어댑터, 기존 Prisma와 Pi ARM64를 유지한다. |
| 자동 검증 | NFR9.1.4, NFR9.2.4, NFR9.3.4. ARM64에서는 기존 TS 전체 스위트와 JVM의 상태 머신을 검증한다. 별도 x64 SDK에서 Kotlin Android 단위 시험과 debug APK 조립을 실행한다. 두 실제 기기에서 잠금 화면, 권한·부팅·Doze, 데이터 FCM과 실제 위치 이벤트, 로그인·전환·회수 시나리오를 검증한다. 앱 설치 가능과 실제 전달 검증을 구분한다. |
