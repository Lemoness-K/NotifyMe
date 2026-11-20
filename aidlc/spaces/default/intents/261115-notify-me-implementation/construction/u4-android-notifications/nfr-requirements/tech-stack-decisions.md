# U4 tech-stack-decisions

## Sources

`functional-spec.md`, `rules.md`, `requirements.md`, `contract-summary.md`, `technology-stack.md`를 적용한다.

## Requirements

- NFR6.1.4. 가용 표시 영역에 맞춰 기기 상태와 제외 후보를 배치하고 좁은 폭에서도 가로 넘침이 없도록 검증한다.
- NFR6.2.4. 키보드와 터치로 제외·복원을 수행하며 확인과 포커스 전환을 검증한다.
- NFR6.3.4. 용량 대기·권한 없음·감시 및 지연을 상태 문구로 구분한다.
- NFR6.4.4. OS 권한이 없어도 업무와 설치 상태의 기본 조회 및 변경을 유지한다.
- NFR7.1.4. 공유 웹과 Android 알림 문구에 확장 가능한 ko-KR/en-US 번역 키를 적용한다.
- NFR7.2.4. 계정 locale 우선, 지원 기기 locale, 한국어 기본값 순으로 선택한다.
- NFR7.3.4. 표시 시각·복수형·수치를 UI locale에 맞추고 네이티브 예약 기준 시각은 유지한다.
- NFR7.4.4. 상태와 오류는 기계 식별용 코드·구조화 값으로 전달하며 UI에서 번역한다.
- NFR7.5.4. 제목과 설명의 원문을 보존하고 공개 알림에는 일반 시스템 문구만 제공한다.
- NFR8.1.4. Capacitor 공유 WebView와 Kotlin 어댑터로 Android 프레임워크를 경계 뒤에 두고 웹은 기능 미지원 상태를 제공한다.
- NFR8.2.4. Node.js 24·Prisma SQLite의 Pi ARM64 호환성을 유지하며 Android SDK·JDK·Gradle 실행은 별도 CI 환경에서 검증한다.
- NFR9.1.4. 서버·공유 UI·순수 Kotlin 규칙을 Red/Green 순서로 검증하고 SDK 다운로드 전에 실행 가능 명령을 확인한다.
- NFR9.2.4. 서버·Web·JVM과 조립 검증을 CI에 연결한다. 실기기 두 대에서 권한·Doze·FCM·위치 실동작을 별도 검증한다.
- NFR9.3.4. 기존 TS 전체 라인 80%와 회귀를 유지한다. JVM 결과는 별도로 기록한다.

## Platform references

- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Android geofencing](https://developer.android.com/develop/sensors-and-location/location/geofencing)
- [Android alarms](https://developer.android.com/develop/background-work/services/alarms)
- [FCM message lifetime](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan)
