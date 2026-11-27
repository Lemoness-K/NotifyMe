# 테스트 전략과 개발 루프 하네스

- 상태: 초안
- 작성일: 2026-11-09
- 최근 갱신일: 2026-11-10
- 관련 결정: `D-008`, `D-011`, `D-021`, `D-030`, `D-041`~`D-051`, `D-053`, `D-056`, `D-058`~`D-078`
- 관련 문서: [마스터 설계](./00-master-design.md), [제품 요구사항](./01-product-requirements.md), [도메인·데이터 설계](./02-domain-and-data-design.md), [시스템 아키텍처](./03-system-architecture.md), [알림과 스케줄링](./04-notification-and-scheduling.md), [배포·운영](./06-deployment-and-operations.md)

## 1. 목적

반복·시간대·권한·동기화와 Android 백그라운드 동작을 빠르게 검증하면서, 테스트가 실제 운영 데이터나 외부 계정에 영향을 주지 않게 한다. 각 개발 루프는 빠른 자동 검증을 통과해야 한다. 느리거나 OS에 의존하는 검증은 별도 주기로 실행한다(`D-070`).

현재 저장소에는 설계 문서만 있고 실행할 앱 코드나 테스트 runner는 없다. 따라서 이 문서는 테스트 경계와 하네스 요구사항을 먼저 고정하고, 실제 명령과 의존성 선택은 코드 저장소를 만들 때 반영한다.

구현되는 테스트는 [전체 ID 추적표](./09-feature-design-coverage-and-backlog.md#7-전체-id-추적표-ds-001)의 검증 위치에 연결하고, 테스트 이름이나 metadata에서 검증 대상 `PR-AC-NNN`/`NFR-*`를 찾을 수 있게 한다. 하나의 테스트가 여러 기준을 확인하면 각 기준 ID를 모두 연결한다.

## 2. 테스트 우선 구현과 리뷰

코드의 동작을 추가하거나 바꿀 때는 구현에 대응하는 자동 테스트를 함께 만든다. 작업은 다음 순서로 진행한다(`D-071`).

1. 요구사항과 수용 기준에서 변경할 동작 및 경계 사례를 뽑는다.
2. 해당 동작을 검증하는 테스트를 먼저 작성한다.
3. assertion이 실제 결과를 검증하고, 잘못된 동작이면 실패하며, fixture가 격리돼 있는지 검토한다. 구현 내부 호출 순서에만 묶인 취약한 테스트는 피한다.
4. 가능하면 테스트가 구현 전에 실패하는 것을 확인하고, 그 테스트를 통과시키도록 코드를 작성한다.
5. 구현과 테스트를 함께 검토하고 매 개발 루프 gate를 실행한다.

작업 에이전트가 테스트와 구현을 자체 검토하므로 사용자는 일반적인 작업마다 별도 테스트 코드 리뷰를 요청하거나 승인할 필요가 없다. 제품 규칙이 불명확하거나 기존 결정과 충돌하면 구현을 임의로 진행하지 않고 해당 부분을 확인한다. Android OS 동작처럼 자동 테스트가 보장할 수 없는 부분은 가능한 adapter·domain 테스트를 작성하고, 기기 검증은 별도 단계에 둔다.

## 3. 매 개발 루프의 필수 검증

기능을 구현하거나 수정한 뒤 다음 검증을 한 번에 실행하는 단일 local command를 제공한다. 코드 저장소 초기화 때 명령명과 도구를 확정한다. 작업 중인 영역에 따라 관련 테스트뿐 아니라 공통 회귀 테스트도 실행한다.

1. TypeScript 프로젝트 전체의 typecheck
2. 도메인과 변경된 UI·API module의 unit test
3. NestJS API와 Prisma·SQLite의 integration test. 실제 migration을 임시 SQLite 파일에 적용하고 test fixture로 초기화한다.
4. Kotlin native module을 수정한 경우 해당 module의 JVM unit test

이 명령은 외부 Firebase, FCM, 실제 Android 계정, 운영 RPi에 접속하지 않는다. 실패 코드를 반환하고 실패한 suite와 관련 로그를 요약한다. 실행 시간이 긴 브라우저 E2E, Android emulator·실기기, RPi 배포, 백업 복구 검증은 매 루프의 필수 통과 조건에 넣지 않는다. 승인된 전체 라인 커버리지 기준은 80%이며 조립된 프로젝트의 전체 테스트로 확인한다. 변경한 동작과 위험 사례는 커버리지 수치와 별도로 직접 검증한다.

## 4. 테스트 수준과 핵심 범위

| 수준 | 실행 위치 | 핵심 사례 |
|---|---|---|
| Unit | 개발 루프 | Reminder 상태 전이, 다중 담당자 완료 의미, 담당자 기본 선택, 반복 회차 산출, 월말·존재하지 않는 날짜, DST, 24시간 알림 cutoff, 구성원 누구나 현재 반복 `PENDING` 회차만 건너뛰고 규칙·다른 회차를 유지하는 상태 전이, 멱등 key, 권한 결정 |
| API·DB integration | 개발 루프 | NestJS endpoint, Firebase identity fake, 임시 SQLite migration·FK·unique constraint·transaction, household tenant 격리, Admin 최소 수, 초대 수락, Assignment 변경, 목록 query가 `requester_user_id`로 필터하며 assignee와 무관하게 미할당 회차를 포함하고 완료·보관 데이터는 제외하는지, 담당자 여부와 무관한 household 구성원의 현재 회차 skip 권한, 비반복·비현재·비`PENDING` 회차 거부, Occurrence skip의 USER actor·시각 기록과 RecurrenceRule·다음 회차 불변, skip 이후 ChangeFeed/Outbox 및 DeviceTrigger 취소, tombstone; 위치 event 만료 purge(`PR-AC-016`, `D-043`), session·installation 폐기 |
| Web UI 흐름 | PR 또는 기능 완성 시 | 생성·요청자/담당자 변경·목록 세 보기 순서와 필터(담당자 기준/요청자 기준/가구 전체), `PR-AC-063`의 가용 폭에 따른 보기 선택 UI 전환 및 선택 상태, `PR-AC-064`의 `할 일` 기본 진입과 `할 일`·`이력`·`보관함` 주요 내비게이션/모바일 하단 메뉴, 완료·보관·이력의 대표 사용자 흐름; 320·360 CSS px, 태블릿·데스크톱 등은 대표 뷰포트 테스트 값이며 최소 지원 크기 경계가 아니다. 각 뷰포트에서 가로 overflow, 키보드·터치, `NFR-UX-003`의 색상 외 상태 인식을 확인한다. CSS px은 PPI나 물리 픽셀 수를 뜻하지 않는다. |
| Android adapter | Kotlin 변경 루프는 JVM unit; 주기적 통합 검증은 emulator/실기기 | 권한·알림 채널 상태와 OS 설정 바로가기, 알람 예약·취소, geofence reconcile, 최초 등록/재등록 callback, stale revision, 동기화된 SKIPPED 회차의 callback 억제, 재부팅, force-stop 후 복귀, 서버 미연결 상태 |
| 운영 smoke | 배포 전 또는 운영 변경 시 | HTTPS·RPi/ARM64·기기 sync·실제 Android 권한과 백그라운드 동작; DDNS DNS, inbound TCP 80/443과 인증서 challenge 사전 확인 및 외부망 접속 |

회귀 suite는 `D-013`, `D-021`, `D-030`, `D-041`~`D-051`, `D-058`~`D-060`, `D-063`~`D-071`, `D-075`~`D-076`의 위험한 상태·경계 동작을 중심으로 늘린다. Android geofence, Doze, 제조사별 절전 동작은 unit fake만으로 OS 보장을 입증할 수 없으므로 Android 검증 단계에 남긴다.

### 모바일 최초 관리자 등록 검증

| 수준 | `PR-AC-058` 최초 관리자 등록 검증 항목 |
|---|---|
| API·SQLite | 명시적으로 준비한 빈 DB에서만 후보를 예약하고, 최초 가구와 ADMIN을 함께 한 번 저장한다. 취소, 만료, 새로고침 뒤 재인증, 중복 제출, 두 계정의 경쟁 및 응답 유실을 검증한다. 후보와 다른 계정 및 기존 가구의 일반 로그인·초대 권한도 검증한다. |
| 운영 통합 | 초기화되지 않은 기존 DB, 누락·장애, 기존/이전 DB 복원, 가구 종료, 승인된 새 주기와 폐기된 후보를 확인한다. 확인 진행 기록 직후 및 SQLite 커밋 후 재기동을 따로 재현하며 새 등록이 열리지 않는지 확인한다. |
| 웹·실기기 | 브라우저에서 계정 표시·확인·취소·리마인더 저장을 검증한다. 별도의 Pi 테스트 설치와 테스트용 Google 계정으로 Wi-Fi를 끈 Android Chrome에서 모바일 데이터·Tailscale 링크, Google 로그인, 최초 설정과 저장·재조회를 확인한다. Chromium 자동화와 이 실기기 결과를 따로 기록한다. |

## 5. 환경 분리

| 환경 | 용도 | 데이터·자격 증명 규칙 |
|---|---|---|
| Development | 개발자의 로컬 UI/API 수동 확인 | 개발용 설정과 별도 로컬 DB 사용. 실사용 계정이나 운영 DB 복사본을 쓰지 않는다. |
| Test | 자동 unit·integration 및 개발 루프 | 실행마다 격리한 임시 SQLite DB에 실제 migration을 적용한다. synthetic fixture와 fake clock·provider만 사용하고, 외부 network·Firebase/FCM credential은 요구하지 않는다. |
| Production | Raspberry Pi에서 실제 household 서비스 운영 | test seed·fixture·자동 destructive test 금지. 개발·test 환경에서 운영 DB나 운영 credential을 읽을 수 없게 분리한다. |

MVP에는 상시 운영하는 별도 staging server를 필수로 두지 않는다. 로컬 development와 자동 test DB는 운영 RPi와 분리하며, 공개 배포 전 필요한 smoke test는 명시적인 별도 절차로 수행한다. 운영 데이터는 test fixture로 복사하지 않는다.

## 6. 개발 루프 하네스

코드 저장소가 생성되면 한 명령으로 제3절의 검증을 실행하는 작은 harness를 만든다. 초기에는 자체 CI나 자동 코드 수정 agent를 만들지 않는다.

- 테스트 전용 설정을 명시하고 production 환경 변수·DB 경로가 감지되면 즉시 중단한다.
- `Clock` port를 고정 시각으로 제어해 시간대·반복·cutoff 검증을 결정적으로 재현한다(`D-064`, `D-065`).
- 매 실행마다 임시 SQLite 경로를 만들고 버전 관리되는 애플리케이션 migration, synthetic seed, cleanup을 명시적으로 실행한다. 실패 시 synthetic data만 든 DB snapshot과 로그를 보존할 수 있게 한다.
- `IdentityProvider`, `PushTransport`, `LocalNotificationScheduler`, `GeofenceScheduler`는 fake adapter로 대체해 외부 로그인·push·위치 서비스 호출 없이 테스트한다.
- 실패 suite, 종료 코드, 소요 시간, 재현에 필요한 test ID를 요약한다. timeout과 반복 횟수 상한을 두고 실패하면 원인을 숨기지 않고 종료한다.
- 변경·검증·수정 루프의 최종 완료 조건은 같은 local harness가 다시 통과하는 것이다. 테스트 기대값을 맞추려고 제품 규칙이나 테스트를 임의로 완화하지 않는다.

## 7. 매 루프 밖의 검증

- 브라우저 E2E와 Android emulator·실기기 acceptance test는 기능 단위 또는 release 후보에서 실행한다.
- 실제 notification permission, exact alarm, geofence, 재부팅과 배터리 정책은 지원 Android 기기에서 검증한다. 작은 household 범위의 기기·OS 조합을 정해 수동/반자동 smoke matrix로 유지한다.
- 백업 복구 리허설은 개발 루프 gate에서 제외한다. migration·backup·restore 구현을 변경하거나 운영 준비를 할 때만 [배포·운영 checklist](./06-deployment-and-operations.md)의 절차로 별도 검증한다.
- systemd unit을 추가·변경하거나 RPi 배포를 준비할 때 부팅 자동 시작, 비정상 프로세스 재시작, `journald` 로그 확인, 로컬 헬스체크가 외부 Caddy 경로에 노출되지 않는지, 서비스 재시작 후 상태 복원을 확인한다(`PR-AC-062`, `D-077`). 디스크·메모리·백업 결과 점검 명령도 운영 절차와 함께 확인한다. 이 검증은 매 개발 루프가 아니라 RPi 배포·운영 변경 때 별도로 실행한다(`D-070`).
- 외부 네트워크 공개, RPi 성능·보안, 계정·가구 삭제 복원은 release/operation readiness에서 별도로 다룬다.

## 8. 도구 선택 시점

테스트 framework와 package script는 코드 저장소 scaffold와 함께 선택한다. 선택 기준은 React/TypeScript UI, NestJS API, Prisma·SQLite integration, Kotlin JVM/Android 테스트를 같은 repo에서 반복 실행할 수 있는지와 Raspberry Pi 개발환경과의 호환성이다. 버전 고정과 lockfile을 적용하며 이 문서만을 근거로 의존성을 미리 설치하지 않는다.
