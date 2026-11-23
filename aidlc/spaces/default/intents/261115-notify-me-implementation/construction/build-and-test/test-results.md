# Build and Test Results

## 검증 기준과 환경

- 소스 커밋 `1e031d095d8435759a2db9699a8a9f1906376f25`. 로컬 Linux ARM64, Node v24.21.0, 테스트용 SQLite와 합성 계정.
- 웹 환경 `FONTCONFIG_FILE="$PWD/.local/fontconfig-u1.conf"`, `LD_LIBRARY_PATH="$PWD/.local/chromium-deps/usr/lib/aarch64-linux-gnu"`, `PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/playwright"`.
- JVM 환경 `JAVA_HOME="$PWD/.local/u4-jdk/usr/lib/jvm/java-21-openjdk-arm64"`, `GRADLE_USER_HOME="$PWD/.local/u4-gradle"`.

## 빌드와 테스트 결과

| 명령 | 종료 코드 | 관찰 결과 |
| --- | ---: | --- |
| `npm run verify:u1` (위 웹 환경) | 0 | 타입 검사, Prisma 생성·TypeScript·Vite 빌드 통과. Vitest 32개 파일·214개 통과, 실패·건너뜀 0. 실제 Chromium 4개 통과, 실패·건너뜀 0. |
| `npm exec -- vitest run tests/u1/` | 0 | 69개 통과 |
| `npm exec -- vitest run tests/u2/` | 0 | 54개 통과 |
| `npm exec -- vitest run tests/u3/` | 0 | 38개 통과 |
| `npm exec -- vitest run tests/u4/` | 0 | 17개 통과 |
| `npm exec -- vitest run tests/u5/` | 0 | 36개 통과 |
| `npm exec -- vitest run tests/u3/http.test.ts` | 0 | U3 HTTP 회귀 10개 통과 |
| `npm exec -- playwright test tests/e2e/u1/` (위 웹 환경) | 0 | 실제 Chromium 1개 통과 |
| `npm exec -- playwright test tests/e2e/u2/` (위 웹 환경) | 0 | 실제 Chromium 1개 통과 |
| `npm exec -- playwright test tests/e2e/u3/` (위 웹 환경) | 0 | 실제 Chromium 1개 통과 |
| `npm exec -- playwright test tests/e2e/u4/` (위 웹 환경) | 0 | 실제 Chromium 1개 통과 |
| `./android/gradlew --offline --no-daemon -p android/schedule-core test` (위 JVM 환경) | 0 | Gradle `:test UP-TO-DATE`. |
| `./android/gradlew --offline --no-daemon --rerun-tasks -p android/schedule-core test` (위 JVM 환경) | 0 | JVM 테스트를 새로 실행했다. Gradle XML 기준 16개 통과, 실패·오류·건너뜀 0. |
| `./android/gradlew --offline --no-daemon -p android :app:testDebugUnitTest :app:assembleDebug` (위 JVM 환경) | 1 | 오프라인 Gradle 클래스패스 해석에서 중단. 이 시도에서는 테스트와 APK 빌드가 시작되지 않았다. |
| `./android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug -PnotifyApiOrigin=https://notify.invalid` (GitHub x64 Android SDK) | 0 | 동일 커밋의 Android 앱 단위 테스트와 디버그 APK 조립 통과. |

범위별 Vitest와 Chromium 재실행은 전체 실행과 겹친다. 전체 집계에는 각 테스트를 한 번만 포함했다. 전체 커버리지 명령은 `npm run verify:u1`에 포함된 `npm run test:coverage`이며 라인 **87.16%**(2919/3349)로 80% 기준을 충족했다. Vite에서 라이브러리의 `use client` 지시문 관련 경고가 나왔으며 빌드는 성공했다. 동일 소스 커밋의 [GitHub 앱 CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/45116211453)도 통과했다.

## 실패 상세와 검증이 남은 항목

- 로컬 Android의 최초 실패는 제품 테스트 단언에서 발생하지 않았다. Gradle의 `Could not resolve all dependencies for configuration 'classpath'` 오류로 `com.android.tools.build:gradle:8.13.0`, `com.google.gms:google-services:4.4.4`, `org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20`을 오프라인에서 해석할 수 없었다. 동일 커밋의 Android SDK 재실행은 통과했다. [GitHub Android CI](https://github.com/Lemoness-K/NotifyMe/actions/runs/45117506039)
- Raspberry Pi 보호 API p95 500ms와 RSS·저장장치 쓰기량의 DS-014 예산은 실기기 부하 모델과 수치가 필요하다. Performance Validation에서 수집할 근거와 실행 조건은 [성능 테스트 안내](performance-test-instructions.md)에 있다.
- Android OS 알림 예약과 실제 FCM 동작은 기기에서 확인할 증거가 필요하다. 백업 장기 보존과 장애 중 산출물의 운영 경계에도 추가 증거가 필요하다. 표준 테스트는 합성 데이터로 실행했다.
- 이미 기록한 U2 권한 변경 경계, U4 Android 일정 저널, U5 장기 보존 및 중단 산출물의 후속 항목은 [Target Verification Matrix](build-and-test-summary.md#target-verification-matrix)에 남겼다.
- 교차 Unit 추적 검사에서 미연결 4개를 확인했다. `FR8.3`과 `FR9.3`의 잔여 정책은 범위 결정상 이연됐고, `NFR5.1`과 `NFR5.2`는 Raspberry Pi 실측이 필요하다. [요구사항별 추적 결과](cross-unit-traceability.md)

## 단계 내 재검증과 판정

Android 빌드 환경은 동일 커밋을 Android SDK가 있는 GitHub 러너로 옮겨 재검증했다. Pi 보호 경로 성능, 실제 Android OS 시험, 운영 저장소의 조건부 보존·중단 검증은 대상 환경 또는 측정 기준을 확보해야 한다. 남은 요구를 충족할 수 있는 빌드 환경 변경은 확인되지 않았다. U2·U4·U5의 알려진 소스 지적은 Code Generation에서 별도 후속 범위로 수용한 상태로 유지한다.

Code Generation으로 되돌린 횟수는 0/3이다. 사용자는 미충족 상태를 수용하고 남은 항목을 이후에 검증하기로 했다. 각 목표의 판정과 추적 결과를 유지한 상태로 Build and Test 승인 검토를 연다. [검증 결과 및 결정 이력](https://github.com/Lemoness-K/NotifyMe/issues/35)

## 준비 상태

웹 빌드와 실행한 웹 자동화 검증은 통과했다. 현재 목표 판정에는 `Not Met`과 `Unverified`가 남아 있어 Build and Test를 성공으로 판정하거나 배포 준비를 완료 처리할 수 없다.
