# U4 단위 테스트 안내

## 실행

Node.js 24, Prisma, Chromium 및 프로젝트 JDK·Gradle wrapper를 사용한다. 첫 Red 전에 U4 경로 수집을 확인한다. standalone JVM 모듈은 Android SDK와 독립적으로 실행한다. 마지막 명령은 Android SDK가 있는 x64 환경에서 실행한다.

```bash
npm exec -- vitest run tests/u4/
npm exec -- playwright test tests/e2e/u4/
./android/gradlew -p android/schedule-core test
./android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug
```

| 범위 | 검증 사례 |
| --- | --- |
| 서버·SQLite | 기존 데이터, 설치별 슬롯 경계, D-097·D-090, 세대·커서·회수, 승인된 nonce와 일회 소비, outbox 수명 |
| Kotlin·Android | 구 범위 정리 복구, 새 인가 확인, 게시·업로드 중단 복구, 알람 경계, 위치 연속성·타이머·권한·중복 |
| 공유 웹 | 대기→확인→활성, 다른 설치 격리, 초안 보존, ko/en, OS 기능과 키보드·터치 |

컴포넌트별 10~15건을 목표로 한다. TypeScript 전체 라인 커버리지 80%는 전체 회귀에서 측정한다. 시험에는 합성 계정·임시 DB·통제 가능한 시계와 FCM·OS 대역을 사용한다. APK 조립과 승인된 두 실기기에서의 실제 동작을 별도 증거로 기록한다.

## 재검토에서 남은 Android 회귀

| 지적 | 자동화로 확인할 동작 |
| --- | --- |
| R-02 | 기존 타이머가 대기 중일 때 위치 OFF와 ON을 연달아 받아도 예전 타이머가 알리지 않는다. 지오펜스 사용 불가에서 등록을 초기화하고 새 기준을 잡는다. |
| R-05 | 동일 부팅·인가·등록의 앱 프로세스 재생성 뒤 첫 실제 전이와 타이머 만료가 각각 복구된다. 등록 또는 권한이 무효화된 이전 콜백은 폐기한다. |
| R-06 | 오프라인 일반 복귀 뒤에도 기존 인가 예약이 동작한다. 확인된 강제 종료·종료 원인 불명 콜드 화면 진입·회수에서는 FULL 전에 캐시를 게시하지 않으며 정지 해제 뒤 부팅 신호로도 우회하지 않는다. |

ARM64 JVM은 실행 후 지속 Gradle 데몬을 남기지 않는다. 전체 회귀에는 인가된 Construction Verification Command를 사용한다. x64에서는 앱 어댑터 호출과 APK 조립을, 실기기에서는 동일 부팅 프로세스 재생성, 강제 종료와 일반 복귀의 실제 OS 동작을 각각 확인한다.
