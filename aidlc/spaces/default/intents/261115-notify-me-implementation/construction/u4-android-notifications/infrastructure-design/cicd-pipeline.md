# U4 CI/CD 설계

## Build and Test

| 검증 | 실행 및 증거 |
| --- | --- |
| 로컬 ARM64 | 기존 npm 검증, ORM 마이그레이션, U4 서버·브라우저 회귀와 전체 TS 라인 80%, 순수 Kotlin JVM 시험. JDK는 고정 버전과 해시를 확인해 별도 작업 디렉터리에 둔다. |
| x64 CI | Node 24, JDK, Android SDK·Gradle wrapper와 잠금 의존성을 설치하고 Android 단위 시험·debug APK 조립을 실행한다. 합성 빌드는 운영 자격 없이 재현하며 빈 설정은 운영 로그인이나 FCM 성공으로 처리하지 않는다. |
| 두 실기기 | 승인된 테스트 Firebase와 APK로 각각 Android 버전·SDK·빌드 SHA·네트워크·권한 초기값을 기록한다. 권한 전환, 부팅, 잠금 화면, Doze, FCM data, 진입·체류·이탈, 대기→제외, 이전 세대 권한 회수와 예상/실제 결과를 남긴다. 기기가 없으면 미실행으로 기록한다. |
| 회귀 | 기존 U1~U3를 유지한다. 99·100 슬롯 활성과 101 슬롯 신규 대기·활성 설치 거부, 이전 scope 제거 중 로그아웃 및 상위 revision을 검증한다. |

Android 수정 검증에서는 위치 OFF·ON과 대기 만료의 실행 순서를 바꿔 재현하고, 제공자 사용 불가 후 재등록을 확인한다. 같은 부팅의 일반 프로세스 재생성 뒤 첫 실제 위치 전이와 타이머, 일반 오프라인 복귀 뒤 TIME 예약, 강제 종료 뒤 FULL 전후의 동작을 각각 기록한다. JVM·Android 테스트는 해당 규칙을 통제된 입력으로 검증한다. Android의 실제 시작 기록과 패키지 정지 해제 뒤 부팅 브로드캐스트는 OS 버전과 빌드가 붙은 실기기 증거로 확인한다. Android 15 이상과 시작 기록을 사용할 수 없는 환경의 결과를 별도 기록한다.

## Promotion and Rollback

코드 계획 승인 후 시험 브랜치를 사용해 x64 조립과 Kotlin 실행을 검증하고 커밋·실행 링크를 남긴다. 프로젝트의 기존 master 갱신 절차를 유지하고 앱 스토어 및 운영 배포는 별도 단계에 둔다. 빌드가 실패하면 실행 및 앱 도구 로그로 진단한다. 운영 앱과 테스트 앱은 데이터·설정 별도다.

## Secrets

테스트는 합성 자격과 로컬 서비스로 실행한다. 운영 FCM 인증·서명 키·서비스 접속 정보는 설정 및 비밀 참조로 주입하고 공개 아티팩트와 검토 이슈에 포함하지 않는다. Firebase 로그인 실기는 Android 앱 식별자 및 서명 등록이 확인된 테스트 설정을 사용한다.

[Android Studio 호스트 요구사항](https://developer.android.com/studio/install), [Capacitor Android 환경](https://capacitorjs.com/docs/getting-started/environment-setup)
