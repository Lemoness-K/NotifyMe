# U4 reliability-design

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

- NFR3.1.4. 업무의 쓰기 경계에 설치 대상 확장과 계획·outbox 참여자를 결합한다. U2 소속 트랜잭션에서 이전 설치 범위를 캡처하고 회수 레코드를 원자 저장한다. 실제 신호는 커밋 후 단일 처리자가 보낸다.
- NFR3.2.4. 마지막 경계 전이와 타이머는 계획·버전별 행에 둔다. 개별 ConditionEvent는 자체 notification ID·게시 상태·업로드 상태를 갖는다. 연속 이벤트 두 건의 서버 응답 순서 또는 프로세스 재시작이 서로의 진행 상태를 덮지 않는다. OS 게시 재시도는 같은 설치 범위와 이벤트의 ID를 사용한다.
- NFR3.3.4. epoch가 달라진 FULL은 이전 범위 ID·새 범위 ID·대기 계획과 전환 상태를 지속 저장한다. 이전 예약·알림·지오펜스와 캐시 제거를 성공할 때까지 반복해 완료한 뒤 새 범위를 적용한다. 기기 부팅·실행이 중단돼도 제거 단계부터 재개한다. 회수의 성공과 재시도를 분리하고 이미 처리한 범위의 늦은 신호는 폐기한다.
- NFR3.4.4. U5에서 복구한 DB의 revision과 독립적인 새 서버 epoch를 발급한 뒤 서비스한다. U4는 epoch가 바뀐 ALL 상태를 FULL로 재조정하는 시험을 수행하며 실제 사본 복구는 U5가 수행한다.
- NFR4.1.4, NFR4.2.4. UTC 예정 시각을 OS 인스턴트로 변환한다. 시계 조정과 DST는 저장 규칙을 바꾸지 않으며 한 부팅의 타이머는 경과 시간으로 비교한다. 24시간 경계 및 소급 재생 금지를 각각 검증한다.

## Android 콜백과 인가 확인

| 상황 | 적용 |
| --- | --- |
| 위치 서비스 OFF 또는 지오펜스 사용 불가 | 수신 시점에 위치 감지 세대를 잠그고 중단 사실을 보존한다. 대기 작업의 실행 순서나 현재 ON 값에 관계없이 이전 등록의 위치 전이·타이머는 폐기한다. 제거·재등록은 별도로 재시도하고 초기 관측을 기준 상태로 저장한다. |
| 일반 프로세스 재생성 | 같은 boot, 현재 설치 범위·권한, 기존 등록 식별자와 일치하는 콜백은 저장한 전이·타이머를 사용한다. 화면 진입과 위치 콜백의 신뢰 경계를 분리한다. |
| 일반 화면 복귀 | 인가된 현재 범위를 유지하며 FULL을 요청한다. 일시 실패는 기존 TIME·LOCATION 예약을 차단하지 않는다. 회수나 새 범위 적용이 확인되면 기존 상태를 잠그고 정리한다. |
| 강제 종료 또는 콜드 화면 진입의 종료 원인 불명 | API 35 이상의 현재 프로세스 시작 기록에서 강제 종료 여부를 확인한다. 이전 API의 사용자 요청 종료 기록만으로 일반 작업 목록 제거와 강제 종료를 구별하지 않는다. 확인이 필요한 시작에서는 인증된 FULL 성공 전 기존 범위를 게시하거나 재등록하지 않는다. Android 15의 패키지 정지 해제 뒤 전달된 BOOT_COMPLETED도 이 제한을 해제하지 않는다. |

위치 등록과 콜백을 다시 검증하기 위해 현재 부팅 ID, 설치 범위와 epoch, 지오펜스 등록 세대, OS 등록 식별자를 보존한다. OFF 또는 제공자 사용 불가를 받은 수신기는 비동기 재등록을 요청하기 전에 잠금 경계를 적용한다. ConditionEvent의 게시는 저장된 각 이벤트 ID로 재시도한다. 범위가 바뀌면 이전 범위의 수신 경로를 먼저 차단하고 남은 정리와 현재 FULL 재확인 후 새 범위를 사용한다.

플랫폼 근거. [Android 15 정지 상태와 시작 기록](https://developer.android.com/about/versions/15/behavior-changes-all), [Android 지오펜스 재등록](https://developer.android.com/develop/sensors-and-location/location/geofencing#reRegister)
