---
layout: review
title: "Notify Me 요구사항"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/requirements-analysis/requirements.md"
permalink: "/reviews/261115-notify-me-implementation/requirements-analysis/20261117-043353894784/01-requirements/"
---

# Notify Me 요구사항

## 의도 분석

가족·동거 가구 구성원 사이의 부탁을 잊지 않도록 등록·배정하고, 시간·장소 알림과 공유 이력으로 수행을 돕는 Notify Me MVP를 상세 설계하고 구현한다. 기존 설계 문서는 계속 기준으로 사용한다. 이번 작업에서 승인된 선택적 완료 검증과 운영자 주간 보고·즉시 장애 알림을 MVP 범위에 추가하며, 승인된 제품 동작과 세부 설계가 필요한 미결정 정책을 분리한다.

성공 기준은 기존 제품 수용 기준과 이번에 추가한 수용 기준을 추적 가능한 설계·구현·검증으로 연결하고, 필요한 Android 확인과 배포 준비를 완료하는 것이다. 실제 Raspberry Pi 설치와 외부 공개는 성공 기준에 포함하지 않는다.

### 분석에 사용한 기준 자료

- 초기 요청: `현재 brownfield인 프로젝트의 설계 문서를 토대로 상세 설계 및 구현하여 리마인더 서비스인 notify me 완성`
- 의도서: `aidlc/spaces/default/intents/261115-notify-me-implementation/ideation/intent-capture/intent-statement.md`
- 작업 범위: `aidlc/spaces/default/intents/261115-notify-me-implementation/ideation/scope-definition/scope-document.md`
- 기존 비즈니스 개요: `aidlc/spaces/default/codekb/toyproj_notify_me/business-overview.md`
- 기존 아키텍처: `aidlc/spaces/default/codekb/toyproj_notify_me/architecture.md`
- 기존 코드 구조 조사: `aidlc/spaces/default/codekb/toyproj_notify_me/code-structure.md`
- 합의된 팀 실천: `aidlc/spaces/default/intents/261115-notify-me-implementation/inception/practices-discovery/team-practices.md`
- 승인된 제품 기준과 결정: `docs/00-master-design.md`, `docs/01-product-requirements.md`, `docs/decision-register.md`, 관련 상세 설계와 ADR

### 요구사항 분해 원칙

FR1–FR10과 NFR1–NFR10은 제품 기능 영역과 품질 속성을 찾기 위한 그룹이다. 하위 FR과 `NFRx.y`는 독립적으로 구현하거나 합격 여부를 판단할 수 있는 세부 동작·품질 조건을 각각 식별한다. 밀접한 동일 흐름의 세부 규칙은 한 하위 요구사항에 남기되, 초대와 권한, 이력과 보관함, 동기화와 예약 reconcile처럼 별도 검증이 가능한 동작은 분리했다. 기존 ID는 유지했고 새 항목에만 새 ID를 부여했다.

## 기능 요구사항

### 계정과 가구

- **FR1** — 사용자는 인증된 계정으로 Notify Me에 접속하고, 같은 가구의 다른 구성원과 공유된 데이터에 접근한다.
  - **FR1.1** — MVP는 Firebase Authentication의 Google 로그인을 사용한다. (`F-ACC-001`, `F-ACC-005`, `PR-AC-001`, `PR-AC-028`, `PR-AC-030`)
  - **FR1.2** — MVP는 하나의 household만 생성·운영하고 다중 가구 생성·전환 UI는 제공하지 않는다. (`F-HH-001`, `PR-AC-027`, `D-022`)
  - **FR1.3** — 가구 구성원은 기존 권한 매트릭스에 따라 Reminder를 공동 관리한다. (`PR-AC-002`~`PR-AC-003`, `docs/01-product-requirements.md` §4, `D-010`)
  - **FR1.4** — 사용자는 현재 설치에서 명시적으로 로그아웃할 수 있다. 로그아웃 또는 현재 세션의 만료·취소가 반영되면 해당 설치의 인증 상태가 종료되고, 다시 로그인할 때까지 사용자·가구 데이터에 대한 인증 접근을 허용하지 않는다. 클라이언트 자격 증명 제거, 서버 측 세션·토큰 취소, 해당 설치의 등록·예약 정리 방식은 상세 설계 `DS-003`에서 구체화한다. (`F-ACC-002`, `NFR-SEC-002`, `docs/07-security-and-privacy.md` §2.2)
  - **FR1.5** — 인증 제공자의 외부 신원은 제공자와 분리된 내부 사용자 ID에 연결한다. (`F-ACC-006`, `PR-AC-029`~`PR-AC-030`)
  - **FR1.6** — 최초 Admin은 승인된 서버 bootstrap 절차로 등록한다. (`F-HH-001`, `PR-AC-058`)
  - **FR1.7** — Admin은 초대 흐름으로 구성원을 household에 가입시킨다. (`F-HH-002`, `PR-AC-028`~`PR-AC-029`)
  - **FR1.8** — Household 구성원과 Admin은 기존 역할·권한 기준에 따라 Reminder 공동 관리 및 구성원 관리 기능을 사용한다. (`F-HH-003`, `F-HH-005`, `PR-AC-002`~`PR-AC-003`, `PR-AC-025`~`PR-AC-026`)

### Reminder와 회차

- **FR2** — 가구 구성원은 부탁을 Reminder로 등록하고, 변경·수행·보관 및 삭제를 관리한다.
  - **FR2.1** — Reminder에는 필수 제목과 선택 설명, 작성자와 요청자를 기록한다. 생성·수정 기본값과 유효성 규칙은 기존 결정 및 수용 기준을 따른다. (`F-REM-001`~`F-REM-003`, `PR-AC-013`, `PR-AC-055`)
  - **FR2.2** — 가구 구성원은 권한에 따라 Reminder를 조회할 수 있다. (`F-REM-002`, `PR-AC-002`)
  - **FR2.3** — 검증 기능이 꺼진 Reminder의 회차는 기존 정책에 따라 가구 구성원이 완료할 수 있다. (`F-REM-005`, `PR-AC-003`)
  - **FR2.4** — Reminder에는 한 명 이상의 담당자를 지정할 수 있으며, 요청자와 실제 수행자를 구분한다. (`F-REM-001`, `F-HIS-001`, `PR-AC-013`~`PR-AC-015`, `PR-AC-055`)
  - **FR2.5** — 구성원은 활성 Reminder를 보관할 수 있다. (`F-REM-004`, `PR-AC-034`)
  - **FR2.6** — 구성원은 Reminder를 영구 삭제할 수 있으며, 삭제 전 복구 불가 안내와 명시적 확인을 제공한다. (`F-REM-004`, `PR-AC-035`, `PR-AC-065`)
  - **FR2.7** — 회차 완료와 완료 취소의 실제 수행자 및 변경 이력을 보존한다. (`F-HIS-001`, `F-HIS-004`, `PR-AC-014`~`PR-AC-015`)
  - **FR2.8** — 가구 구성원은 권한에 따라 Reminder를 수정할 수 있다. (`F-REM-003`, `PR-AC-002`)
  - **FR2.9** — 검증 기능이 꺼진 Reminder의 완료 회차를 기존 정책에 따라 가구 구성원이 완료 취소할 수 있다. (`F-REM-005`, `PR-AC-003`)
  - **FR2.10** — 가구 구성원은 보관함의 Reminder를 복원할 수 있다. (`F-REM-004`, `PR-AC-034`)

- **FR3** — 시스템은 반복 규칙과 개별 Occurrence를 관리한다.
  - **FR3.1** — 반복 규칙은 MVP에서 일·주·월 단위 반복과 선택 종료일을 지원한다. (`F-REC-001`~`F-REC-003`, `PR-AC-032`, `PR-AC-046`~`PR-AC-050`)
  - **FR3.2** — 사용자는 이번 회차와 이후 회차 또는 전체 반복 등 기존에 정한 범위로 반복 규칙을 편집할 수 있다. (`F-REC-005`~`F-REC-006`, `D-063`, `PR-AC-049`)
  - **FR3.3** — Reminder 수명주기와 개별 Occurrence 진행 상태를 서로 다른 상태 흐름으로 관리한다. (`F-REM-007`~`F-REM-008`, `D-035`, `D-036`, `PR-AC-033`~`PR-AC-037`)
  - **FR3.4** — 담당자가 없는 반복 Reminder는 새 회차 생성을 일시 중지하고 담당자가 다시 지정되면 재개한다. (`F-REC-008`, `D-060`, `PR-AC-013`)
  - **FR3.5** — 반복 Reminder를 보관하면 알림과 새 회차 생성을 멈추고, 복원하면 기존 규칙의 다음 미래 회차부터 재개한다. (`F-REC-008`, `D-033`, `PR-AC-034`)
  - **FR3.6** — 보관 전에 생성된 미완료 회차는 복원 후 다시 활성화하며, 지난 시간 Trigger는 `OVERDUE`로 표시하고 과거 알림은 재생하지 않으며 장소 Trigger는 다시 등록한다. (`D-034`, `PR-AC-034`)
  - **FR3.7** — 가구 구성원은 반복 Reminder의 현재 `PENDING` 회차 하나만 건너뛸 수 있으며, 반복 규칙이나 다른 회차는 바뀌지 않는다. (`F-REC-006`, `D-075`, `PR-AC-060`)

### 알림, 동기화, 목록과 기록

- **FR4** — 사용자는 시간·장소 조건에 따라 Android 시스템 알림을 받는다.
  - **FR4.1** — 서버에 저장한 시간 Trigger를 대상 Android 기기에 로컬 예약하고, 앱 UI가 보이지 않아도 OS 권한이 허용된 경우 알림을 표시한다. 정확 알람 권한, 지연 허용, 재부팅 복구 및 중복 억제는 기존 결정을 따른다. (`F-TRG-001`, `F-NOT-002`~`F-NOT-003`, `PR-AC-004`~`PR-AC-005`, `PR-AC-008`)
  - **FR4.2** — 장소 Trigger는 저장한 장소와 반경 및 선택한 진입·이탈·머무름·이탈 후 경과 조건에 따라 대상 Android 기기에서 처리한다. (`F-TRG-002`~`F-TRG-004`, `F-NOT-005`, `PR-AC-006`, `PR-AC-016`, `PR-AC-066`)
  - **FR4.3** — 사용자는 알림 설정과 OS 권한 상태를 확인하고 필요한 OS 설정 화면으로 이동할 수 있다. (`F-NOT-006`~`F-NOT-007`, `F-SET-004`, `PR-AC-009`, `PR-AC-057`)
  - **FR4.4** — 잠금 화면 알림에 표시되는 내용은 기존 개인정보 공개 정책을 따른다. (`F-NOT-006`, `PR-AC-059`)
  - **FR4.5** — 취소되거나 더 이상 유효하지 않은 회차는 해당 설치의 알림 예약을 해제한다. (`F-NOT-009`, `PR-AC-009`)
  - **FR4.6** — 위치 권한이 거부된 경우에도 LOCATION Reminder 저장을 허용하고 해당 설치에 알림 불가 상태와 Android 설정 경로를 표시한다. (`F-SET-004`, `PR-AC-009`, `D-044`)
  - **FR4.7** — 시간·장소 알림 예약 대상은 Reminder의 담당자에게 연결된 설치로 제한한다. (`F-NOT-009`, `PR-AC-013`)
  - **FR4.8** — 새 LOCATION Reminder 저장이나 담당자 변경이 대상 설치의 geofence 용량을 넘으면 변경을 저장하지 않고 입력을 보존하며, 슬롯 확보 후 재시도할 방법을 안내한다. (`F-TRG-003`, `PR-AC-006`, `PR-AC-068`, `D-090`)

- **FR5** — 사용자는 활성 할 일, 완료 이력 및 보관함을 조회한다.
  - **FR5.1** — 활성 목록은 내 할 일·내가 요청한 일·가구 전체 보기와 기한 초과·오늘·예정 분류를 기존 정렬·필터 규칙으로 제공한다. (`F-LIST-001`~`F-LIST-003`, `F-LIST-005`, `PR-AC-056`, `PR-AC-061`, `PR-AC-063`)
  - **FR5.2** — 완료·놓침·건너뜀 및 주요 변경 이력을 저장하고, 사용자가 담당 Reminder 또는 가구 전체 범위로 조회한다. (`F-LIST-004`, `F-HIS-001`~`F-HIS-004`, `PR-AC-011`, `PR-AC-064`)
  - **FR5.3** — 사용자는 보관된 Reminder 목록을 보관함에서 조회할 수 있다. (`F-LIST-008`, `PR-AC-034`)

- **FR6** — 서버는 공유 데이터의 기준 시스템이며 연결된 클라이언트와 Android 설치는 최신 상태를 동기화한다.
  - **FR6.1** — 브라우저와 Android 앱은 집 안팎에서 HTTPS로 서버를 조회·변경한다. (`F-CLI-001`~`F-CLI-004`, `F-NOT-004`, `PR-AC-007`, `PR-AC-010`, `D-011`)
  - **FR6.2** — FCM은 사용자에게 보이는 알림이 아닌 변경 신호로 사용한다. (`F-NOT-004`, `PR-AC-010`, `NFR-REL-005`)
  - **FR6.3** — 공유 UI와 도메인은 Android SDK에 직접 의존하지 않고 플랫폼 중립 인터페이스를 통해 알림·예약·지오펜스·권한 기능을 사용한다. (`F-CLI-003`, `PR-AC-012`)
  - **FR6.4** — 앱 재시작·기기 재부팅·권한 변경 후 로컬 예약과 지오펜스를 서버 상태에 맞춰 멱등하게 reconcile한다. (`F-NOT-004`, `PR-AC-008`, `NFR-REL-005`~`NFR-REL-006`)

### 설정과 선택 기능

- **FR7** — 사용자는 개인·가구 설정과 설치별 권한·기능 상태를 관리한다.
  - **FR7.1** — Admin은 가구 공통 설정을, 구성원은 허용된 개인 설정을 관리한다. (`F-SET-001`~`F-SET-004`, `PR-AC-022`, `PR-AC-025`)
  - **FR7.2** — 사용자는 개인 설정에서 UI 언어를 선택하며 선택값은 서버에 저장되어 해당 사용자의 다른 설치와 동기화된다. 유효한 저장 사용자 locale은 기기 locale보다 우선한다. 유효한 저장 locale이 없거나 지원되지 않으면 지원되는 기기 locale을 사용하고, 기기 locale도 지원되지 않으면 기본값 `ko-KR`을 사용한다. MVP 지원 locale은 한국어(`ko-KR`)와 영어(`en-US`)다. (`F-SET-003`, `PR-AC-052`, `D-066`, `D-093`, `Q-065`, `AFR-001`)
  - **FR7.3** — 기기별 알림·위치 권한 및 알림 채널 상태를 표시한다. 권한이 없어도 기본 업무 관리 기능을 사용할 수 있다. (`F-NOT-007`, `F-SET-004`, `PR-AC-009`, `PR-AC-057`)
  - **FR7.4** — 날짜·시간·숫자 표시는 사용자 locale과 저장된 IANA 시간대 및 일정별 시간대 정책에 맞춘다. (`F-ACC-003`, `F-SET-003`, `PR-AC-051`, `D-065`~`D-066`)
  - **FR7.5** — 사용자가 작성한 Reminder 제목과 내용은 자동 번역하거나 변경하지 않는다. (`F-SET-003`, `D-065`, `ADR-034`)
  - **FR7.6** — 설정 가능한 기능은 설정 카탈로그에 scope, 기본값, 자료형, 검증 규칙, 비활성화·제거 동작을 등록한다. (`F-SET-005`, `PR-AC-023`~`PR-AC-024`, `D-019`)
  - **FR7.7** — 사용자는 기기 권한·알림 채널의 세부 설정을 바꾸기 위해 해당 Android OS 설정 화면으로 이동할 수 있다. (`F-SET-004`, `PR-AC-009`, `PR-AC-057`, `D-073`)

### 승인된 MVP 범위 추가

- **FR8** — 사용자는 Reminder별 선택적 완료 검증을 설정할 수 있다. (`F-REM-009`, `Q-063`, `D-091`, `PR-AC-069`)
  - **FR8.1** — 검증이 켜진 Reminder에서 담당자가 회차 완료를 표시하면 회차는 검증 대기 상태가 되고, 지정된 다른 가구 구성원이 검증한다.
  - **FR8.2** — 지정 검증자의 승인은 회차를 완료로 확정하고, 거절은 미완료 상태로 되돌린다. 검증 응답 전에는 대기 상태를 유지한다.
  - **FR8.3** — 검증자 자격·권한 경계, 여러 담당자·검증자 상호작용, 요청 취소·만료·재알림 및 검증자 알림의 필요성과 전달 방식은 `Q-063`에 열린 정책 항목으로 남기며, 세부 설계에서 확정하기 전에는 구체적인 동작을 가정하지 않는다. 이 하위 요구사항의 상태는 `Deferred`다.

- **FR9** — 운영자는 선택 기능으로 주간 운영 보고와 장애 발생 즉시 알림을 받을 수 있다. (`F-OPS-007`~`F-OPS-008`, `Q-064`, `D-092`, `PR-AC-070`)
  - **FR9.1** — 운영 보고는 매주 제공한다.
  - **FR9.2** — 기능 설정에서 장애 알림을 선택적으로 활성화할 수 있으며, 장애가 감지되면 운영자에게 즉시 알린다.
  - **FR9.3** — 운영자 자격, 보고 내용·기준 시간대, 장애 신호·판정·중복 억제, 수신자·전달 채널·재시도 및 기능별 활성화 세부는 `Q-064`의 열린 정책으로 남긴다. 이 하위 요구사항은 `Deferred`이며 상세 설계에서 결정하기 전에는 세부 동작을 요구하지 않는다.

### 운영

- **FR10** — 제품은 Raspberry Pi MVP 배포를 위한 운영·복구 수단을 제공한다.
  - **FR10.1** — NestJS API·Worker는 systemd로 등록해 RPi 부팅 시 자동 시작하고 비정상 종료 후 재시작한다. (`F-OPS-001`, `F-OPS-004`, `PR-AC-062`)
  - **FR10.2** — 운영자는 서비스 상태, 로컬 헬스체크, 디스크·메모리 사용량과 백업 결과를 확인할 수 있으며 MVP에는 운영 대시보드를 두지 않는다. (`F-OPS-002`~`F-OPS-003`, `PR-AC-062`)
  - **FR10.3** — SQLite 데이터의 일관된 백업을 생성한다. (`F-OPS-003`, `PR-AC-031`, `NFR-REL-003`)
  - **FR10.4** — 서비스 업데이트와 DB migration 절차를 설계하고 검증하며, 실패 시 데이터와 이전 운영 상태를 보호한다. (`F-OPS-005`, `NFR-REL-003`)
  - **FR10.5** — 별도 파일·장치·서비스에 보관하는 백업은 암호화하고 복구 key는 백업 본체와 분리한다. (`F-OPS-003`, `PR-AC-031`, `NFR-SEC-006`)
  - **FR10.6** — API·Worker의 애플리케이션 로그를 표준 출력·오류로 기록해 운영자가 `journald`에서 확인할 수 있다. (`F-OPS-002`, `PR-AC-062`)
  - **FR10.7** — 운영자는 별도 보관한 백업에서 SQLite 데이터를 복구할 수 있고, 복구 절차를 검증한다. (`F-OPS-003`, `PR-AC-031`, `NFR-REL-003`)

## 비기능 요구사항

- **NFR1** — 인증, household 권한, 데이터 격리와 자격 증명 처리는 검증 가능하고 안전해야 한다. (`NFR-SEC-001`~`NFR-SEC-005`)
  - **NFR1.1** — 데이터 접근은 유효한 인증을 요구하며 세션을 안전하게 처리한다. (`NFR-SEC-002`, `PR-AC-001`, `PR-AC-028`~`PR-AC-030`)
  - **NFR1.2** — 서버는 각 요청에서 household 소속과 역할별 권한을 확인한다. (`NFR-SEC-001`, `PR-AC-002`~`PR-AC-003`, `PR-AC-025`~`PR-AC-026`)
  - **NFR1.3** — 서로 다른 household 데이터는 query·응답·동기화 경계에서 격리한다. (`NFR-SEC-003`, `PR-AC-001`~`PR-AC-003`)
  - **NFR1.4** — 초대·기기 자격 증명은 안전하게 저장·전송하고 로그에 노출하지 않는다. (`NFR-SEC-004`~`NFR-SEC-005`, `PR-AC-028`~`PR-AC-031`)
- **NFR2** — 개인 일정·위치·가구 데이터는 승인된 개인정보 보호와 보존 정책을 따라야 한다. (`NFR-SEC-006`)
  - **NFR2.1** — 개인 일정과 위치는 필요한 최소 범위로 수집·보존하며 백업·삭제 정책을 지킨다. (`NFR-SEC-006`, `PR-AC-031`, `PR-AC-043`)
  - **NFR2.2** — 잠금 화면에는 기존 개인정보 공개 정책에서 허용된 알림 내용만 표시한다. (`PR-AC-059`, `docs/07-security-and-privacy.md`)
  - **NFR2.3** — 감사 이력과 계정 데이터는 기존 접근·보존 정책을 지킨다. (`NFR-SEC-006`, `docs/07-security-and-privacy.md`)
- **NFR3** — 데이터 변경, 재시도, 예약 동기화와 운영 복구는 중복 및 부분 적용을 제한해야 한다. (`NFR-REL-001`~`NFR-REL-007`)
  - **NFR3.1** — 다중 저장 변경은 일관된 transaction으로 적용하고 중단 시 부분 상태를 남기지 않는다. (`NFR-REL-001`, `NFR-REL-003`)
  - **NFR3.2** — 반복 회차 생성과 예약 작업은 재실행되어도 멱등하며 중복 전달을 제한한다. (`NFR-REL-002`, `NFR-REL-004`, `PR-AC-032`)
  - **NFR3.3** — FCM 변경 신호와 설치별 로컬 예약·지오펜스 reconcile은 재시도와 재부팅 뒤에도 멱등하다. (`NFR-REL-005`~`NFR-REL-006`, `PR-AC-008`, `PR-AC-010`)
  - **NFR3.4** — 운영 복구 절차는 문서화하고 실제 백업에서 복구 가능함을 검증한다. (`NFR-REL-003`, `NFR-REL-007`, `PR-AC-031`)
- **NFR4** — 일정 데이터의 시각 저장·계산·표시는 시간대와 달력 경계에서 일관되어야 한다. (`NFR-TIME-001`~`NFR-TIME-004`)
  - **NFR4.1** — 영속 시각은 UTC instant로 저장하며 반복 규칙과 사용자 표시에는 명시적 IANA time zone을 사용한다. (`NFR-TIME-001`~`NFR-TIME-002`, `PR-AC-050`~`PR-AC-051`)
  - **NFR4.2** — DST의 존재하지 않거나 중복되는 시각 및 기기·서버 시계 변경은 기존 결정과 테스트 전략대로 처리한다. (`NFR-TIME-003`~`NFR-TIME-004`)
- **NFR5** — 서버 응답과 runtime footprint는 Raspberry Pi의 소규모 단일 노드 운영 목표에 맞아야 한다. (`NFR-PERF-001`~`NFR-PERF-003`)
  - **NFR5.1** — 가정 내 소규모 사용에서 주요 서버 화면 응답은 p95 500ms 이하를 목표로 한다. (`NFR-PERF-001`, `PR-AC-044`)
  - **NFR5.2** — 서비스는 Raspberry Pi의 제한된 메모리와 저장장치 쓰기를 고려해야 한다. (`NFR-PERF-002`, `PR-AC-031`, `PR-AC-044`)
  - **NFR5.3** — MVP는 수평 확장보다 단일 노드의 단순성과 복구성을 우선한다. (`NFR-PERF-003`, `PR-AC-044`)
- **NFR6** — Web UI는 다양한 화면과 입력 방식에서 주요 사용자 흐름을 사용할 수 있어야 한다. (`NFR-UX-001`~`NFR-UX-004`)
  - **NFR6.1** — Web UI는 고정 기기 종류·너비에 종속되지 않고 가용 뷰포트에 따라 유동적으로 재배치한다. 최소 지원 화면 크기를 정하지 않는다. 대표 테스트 너비(예: 360 CSS px)는 최소 지원 경계가 아니다. (`NFR-UX-001`, `PR-AC-007`, `PR-AC-043`)
  - **NFR6.2** — 주요 흐름은 가로 넘침 없이 키보드와 터치로 조작할 수 있다. (`NFR-UX-002`, `PR-AC-007`, `PR-AC-043`)
  - **NFR6.3** — 상태를 색상만으로 구분하지 않는다. (`NFR-UX-003`, `PR-AC-063`)
  - **NFR6.4** — 알림·위치 권한이 거부되어도 기본 업무 관리 기능을 사용할 수 있다. (`NFR-UX-004`, `PR-AC-009`, `PR-AC-057`)
- **NFR7** — UI·시스템 문구, locale 선택과 locale별 형식은 확장 가능한 다국어 정책을 따라야 한다. (`NFR-I18N-001`~`NFR-I18N-002`)
  - **NFR7.1** — UI 및 시스템 생성 문구를 번역 키·locale resource로 분리하고, 새 locale은 도메인 데이터나 업무 규칙 변경 없이 추가할 수 있어야 한다. MVP locale은 `ko-KR`과 `en-US`다. (`NFR-I18N-001`, `PR-AC-052`, `AFR-001`)
  - **NFR7.2** — 유효한 저장 사용자 locale이 기기 locale보다 우선한다. 유효한 저장 locale이 없거나 지원되지 않으면 지원되는 기기 locale을 적용하고, 기기 locale도 지원되지 않으면 `ko-KR`을 사용한다. (`D-093`, `Q-065`, `AFR-001`)
  - **NFR7.3** — 날짜·시간·숫자·복수형은 사용자 locale과 시간대에 맞춰 표현한다. (`NFR-I18N-002`, `PR-AC-052`, `D-065`~`D-066`)
  - **NFR7.4** — API는 번역 문구 대신 locale-neutral한 오류 코드·enum·구조화 값을 반환한다. (`NFR-I18N-001`, `ADR-034`)
  - **NFR7.5** — 사용자 작성 값은 자동 번역하거나 locale 처리 과정에서 변경하지 않는다. (`D-065`, `ADR-034`)
- **NFR8** — 제품 경계는 플랫폼별 API와 배포 환경 차이를 수용해야 한다. (`PR-AC-012`, `D-006`, `D-008`, `D-053`~`D-057`)
  - **NFR8.1** — 도메인과 공유 UI는 Android SDK에 직접 결합하지 않고 플랫폼 중립 경계를 사용한다. (`PR-AC-012`, `D-006`, `D-008`, `D-052`)
  - **NFR8.2** — 계획된 기술 스택과 native dependency의 Raspberry Pi ARM64 호환성을 구현 착수 시 확인한다. (`D-053`~`D-057`)
- **NFR9** — 팀은 합의된 개발·테스트 방식과 커버리지 목표를 적용한다. (`D-071`, Practices Discovery `team-practices.md`)
  - **NFR9.1** — 동작 변경은 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패를 확인하는 TDD 순서를 따른다. (`D-071`, `team-practices.md`)
  - **NFR9.2** — 변경 동작과 주요 위험을 검증하는 자동 테스트 및 CI를 실행한다. (`team-practices.md`, `docs/08-test-strategy.md`)
  - **NFR9.3** — 전체 line coverage 목표는 80%다. 이 목표와 `docs/08-test-strategy.md`의 고정 전체 coverage 기준 미사용 문구가 충돌하므로 구현 전 문서를 정합화한다. (`team-practices.md`, `docs/08-test-strategy.md`)
- **NFR10** — 서비스 운영 상태를 진단할 수 있고 관리 기능·비밀값이 공개 ingress에 노출되지 않아야 한다. (`PR-AC-062`, `D-077`, `NFR-REL-007`)
  - **NFR10.1** — 운영자는 서비스 오류·상태·백업 결과를 명령과 로그로 진단할 수 있다. (`PR-AC-062`, `D-077`, `NFR-REL-007`)
  - **NFR10.2** — 로컬 헬스체크·비밀값·관리 포트는 공개 ingress를 통해 노출되지 않는다. (`PR-AC-062`, `docs/07-security-and-privacy.md`)

## 시나리오 및 경계 조건 검토

| 적용 조건 | 처리 위치 |
|---|---|
| 첫 실행, 로그인·세션 만료, 가구·역할 경계 | `FR1.1`~`FR1.8`, `NFR1`; 인증·초대·가구 예외 흐름은 `DS-003`에서 상세화한다. |
| Reminder 입력·수정·보관·영구 삭제, 완료와 검증 | `FR2.1`~`FR2.10`, `FR8.1`~`FR8.3`; 필드 경계·오류 문구·취소 상태는 `DS-004`·`DS-005`에서 상세화한다. 영구 삭제 확인은 기존 `PR-AC-065`를 따른다. |
| 빈 목록·다수 항목·오류·응답 지연, 화면별 상태 표현 | 목록 범위는 `FR5.1`~`FR5.2`; 로딩·빈·오류·재시도 및 페이지 표현은 `DS-002`·`DS-005`·`DS-009`에서 상세화한다. MVP의 완전한 오프라인 편집과 충돌 해결은 제외한다(`FR6.1`). |
| 반복의 날짜 경계·시간대·DST·중복 실행 | `FR3.1`~`FR3.7`, `NFR3`~`NFR4`; 기존 결정과 테스트 범위를 따르고 반복 anchor 및 예외 상호작용은 `DS-010`에서 상세화한다. |
| 권한 거부, 기기 재시작, 예약·지오펜스 용량 및 동기화 재시도 | `FR4.1`~`FR4.8`, `FR6.2`, `NFR3`; 권한 거부와 용량 초과는 별도 요구사항으로 추적하고 설치별 복구 흐름은 `DS-006`·`DS-011`에서 상세화한다. |
| 반응형 재배치, 키보드·터치, 비색상 상태 표시, 다양한 locale의 문구·날짜·숫자 | `NFR6`~`NFR7`, `FR7.2`; 화면 배치 및 대표 viewport 검증은 `DS-002`·`DS-014`에서 정하며 대표 테스트 값은 제품의 최소 지원 경계를 뜻하지 않는다. 사용자 작성 내용은 자동 번역하지 않는다. |
| 동시 변경, 반복 작업 재실행, 저장·백업·복구, 운영 진단 | `FR6.2`, `FR10.1`~`FR10.7`, `NFR2`~`NFR3`, `NFR10`; 동시성·원자성·운영 복구 기준은 `DS-008`·`DS-009`·`DS-014`와 테스트 전략에서 상세화한다. |
| 비용·외부 제공자·운영 계정·실제 개인 데이터 | 기존 범위와 `NFR2`를 따른다. 사용자 승인 없이 유료 서비스나 외부 계정을 도입하지 않으며, 테스트에는 합성 데이터와 로컬 리소스를 사용한다. |

## 제약

- 이번 범위는 문서화된 MVP와 승인된 Q-063·Q-064 추가로 제한한다. 기존 후속 기능은 보존하고 이번 작업에서는 구현하지 않는다.
- 기존 결정·수용 기준·질문 ID를 기준선으로 유지한다. 이 문서의 FR/NFR ID는 영구 추적 키이며 후속 단계에서 재번호화하지 않는다.
- 기존 기술 선택은 구현 전 검증 대상으로 삼는다. 현재 저장소는 제품 코드·패키지 manifest·빌드·테스트·CI가 없는 brownfield 문서 저장소다.
- 실제 Raspberry Pi 설치·배포, 외부 인터넷 공개, 라우터 포트 개방은 수행하지 않는다. 배포 파일·절차와 사전 검증은 범위에 포함한다.
- 별도 승인 없이 유료 서비스, 새 외부 사업자 계정 또는 운영 자격 증명을 요구하지 않는다.
- 문서와 사용자 대면 기본 언어는 한국어이며 요구사항·결정·수용 기준의 기존 ID는 그대로 보존한다.
- MVP UI locale은 `ko-KR`, `en-US`이며 이후 언어 확장을 위해 번역 리소스와 도메인 로직을 분리한다.

## 가정

- 기존 `docs/00-master-design.md`, `docs/01-product-requirements.md`, 세부 설계 및 `docs/decision-register.md`는 최신 사용자 승인 범위와 명시적 결정에 부합하는 한 계속 기준으로 사용한다.
- 단일 가구의 가족·동거 구성원이 주요 제품 사용자이며, 제품 운영자는 초기 운영 보고·장애 알림의 대상 이해관계자다.
- 구현에 필요한 기술·서비스 결정은 이미 선택된 항목을 우선 사용하고, 실제 버전 호환성은 구현 시 검증한다.
- 완료 검증과 운영자 보고·장애 알림의 MVP 포함은 승인되었다. 세부 정책은 승인 전까지 열린 질문으로 남긴다.
- 사용자 입력의 구체적인 길이 제한, 목록의 최대 페이지 크기와 화면별 빈·오류 문구는 현재 기준 문서가 정하지 않는다. 이를 이번 요구사항에서 임의 수치로 확정하지 않고 관련 상세 설계에서 기존 정책과 사용 흐름에 맞춰 정한다.

## 범위 제외

- iOS 앱·알림, 추가 인증 제공자, 다중 가구 생성·전환 UI, 계정 삭제·가구 종료, 데이터 내보내기, snooze, 고급 검색·필터·캘린더, 고급 반복 규칙 및 상용 운영자 콘솔.
- Play Store 배포·결제, 캘린더·메신저·음성비서 연동, 파일 첨부·댓글·태그·우선순위, 완전한 오프라인 편집과 기기 간 충돌 해결.
- 운영 Raspberry Pi에 실제 설치하거나 공개 네트워크 경로를 변경하는 작업.
- 사용자 작성 Reminder 제목·설명 등 내용의 자동 번역.

## 열린 질문

- **Q-063** — 검증자 자격·권한, 다중 담당자/검증자 간 규칙, 검증 대기 취소·만료·재알림, 반복 회차와의 상호작용, 검증자 알림과 화면·데이터 동작. 관련 설계는 `DS-004`, `DS-005`, `DS-009`에서 구체화한다.
- **Q-064** — 운영자 자격·수신자, 보고 내용과 기준 시간대, 장애 신호·판정·중복 억제, 전달 채널·재시도 및 선택 기능 활성화. 기존 비용·외부 계정 제약을 유지하고 운영 설계에서 구체화한다.
- 팀의 80% 전체 라인 커버리지 목표와 `docs/08-test-strategy.md`의 문서 표현은 구현 전에 정합화한다.
- 계획된 Prisma 7·SQLite driver adapter 및 Android·RPi 의존성의 실제 버전·ARM64 호환성을 구현 착수 시 확인한다.

## 요구사항 등록부

이 등록부는 요구사항 유형, 기원, 정책 상태, 출처 또는 도출 근거, 검증 기준, 후속 추적 대상을 요구사항 ID별로 기록한다. `Approved`는 해당 제품 동작이나 품질 제약의 근거 정책이 프로젝트에서 승인됐음을 뜻하며, 추적 커버리지 상태(`OK`, `GAP` 등)와는 별개다. `Derived` 항목은 출처 ID를 요구사항 본문에 연결하고, 부모 요구를 검증 가능한 동작으로 분해하거나 승인된 불변식을 만족하는 데 필요한 이유를 아래에 적었다. 명시적으로 승인되지 않은 AI 제안은 정식 요구사항으로 포함하지 않는다. `FR1`~`FR10`, `NFR1`~`NFR10`은 탐색용 그룹이며 별도 동작의 합격 조건은 하위 ID가 정의한다. 모든 ID의 출처·검증·후속 추적은 개별 행에 기록한다.

| ID | Type | Origin | Status | Source / derivation | Acceptance / verification | Downstream traceability |
|---|---|---|---|---|---|---|
| FR1 | FR | Derived | Approved | 사용자 목표와 승인된 `F-ACC`·`F-HH` 정책을 인증·가구 접근 흐름으로 묶음 | FR1.1–FR1.8의 PR-AC; `docs/08-test-strategy.md` §4 인증/API | User Stories 다음 단계; `DS-003`, `DS-009` |
| FR1.1 | FR | Derived | Approved | 승인된 `F-ACC-001`, `F-ACC-005`, `PR-AC-001`, `PR-AC-028`, `PR-AC-030`; MVP 인증 제공자 선택 | `PR-AC-001`, `PR-AC-028`, `PR-AC-030`; §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR1.2 | FR | Derived | Approved | 승인된 `F-HH-001`, `PR-AC-027`; MVP household 수를 한 개로 제한 | `PR-AC-027`; §4 tenant/권한 API | User Stories; `DS-003`, `DS-009` |
| FR1.3 | FR | Derived | Approved | 승인된 `PR-AC-002`–`003`, `D-010`; 같은 가구의 공유 Reminder 관리 규칙 | `PR-AC-002`–`003`; §4 tenant/권한 API | User Stories; `DS-003`, `DS-004`, `DS-009` |
| FR1.4 | FR | Derived | Approved | 승인된 `F-ACC-002`, `NFR-SEC-002`, 보안 §2.2; 세션이 끝난 설치의 데이터 접근 차단을 보장하는 데 필요 | 로그아웃·만료·취소 뒤 인증 요청 거부; `DS-003`, §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR1.5 | FR | Derived | Approved | 승인된 `F-ACC-006`, `PR-AC-029`~`PR-AC-030`; 외부 인증 신원과 내부 업무 ID를 분리 | `PR-AC-029`~`PR-AC-030`; §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR2 | FR | Derived | Approved | 승인된 `F-REM` 및 `F-HIS` 정책을 Reminder 생명주기로 묶음 | FR2.1–FR2.10의 PR-AC; §4 Reminder API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.1 | FR | Derived | Approved | 승인된 `F-REM-001`–`003`, `PR-AC-013`, `PR-AC-055`; Reminder의 핵심 기록 필드와 검증 정책 | `PR-AC-013`, `PR-AC-055`; §4 core API/UI | User Stories; `DS-004`, `DS-009` |
| FR2.2 | FR | Derived | Approved | 승인된 `F-REM-002`, `PR-AC-002`; Reminder 조회 권한 | `PR-AC-002`; §4 core API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.3 | FR | Derived | Approved | 승인된 `F-REM-005`, `PR-AC-003`; 검증 기능이 꺼진 기본 완료 흐름 | `PR-AC-003`; §4 domain/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR3 | FR | Derived | Approved | 승인된 `F-REC` 및 recurrence 정책을 규칙·회차 흐름으로 묶음 | FR3.1–FR3.7의 PR-AC; §4 recurrence/fake-clock | User Stories; `DS-006`, `DS-010` |
| FR3.1 | FR | Derived | Approved | 승인된 `F-REC-001`–`006`, `F-REC-008` 및 명시된 recurrence 수용 기준 | `PR-AC-011`, `032`, `046`–`050`, `060`, `067`; §4 recurrence | User Stories; `DS-006`, `DS-010` |
| FR3.2 | FR | Derived | Approved | 승인된 `F-REC-005`–`006`, `D-063`; 반복 수정 범위에 필요 | `D-063`, `PR-AC-049`; §4 recurrence | User Stories; `DS-006`, `DS-010` |
| FR3.3 | FR | Derived | Approved | 승인된 `D-035`, `D-036` 및 상태 관련 수용 기준; Reminder·Occurrence 상태를 분리해 관리 | `PR-AC-033`–`037`; §4 recurrence/state | User Stories; `DS-006`, `DS-010` |
| FR4 | FR | Derived | Approved | 승인된 Trigger·notification 정책을 Android 사용자 흐름으로 묶음 | FR4.1–FR4.8의 PR-AC; §4 Android adapter/device | User Stories; `DS-002`, `DS-006`, `DS-011` |
| FR4.1 | FR | Derived | Approved | 승인된 `F-TRG-001`, `F-NOT-002`–`003`, 기존 시간 알림 기준 | `PR-AC-004`–`005`, `008`; §4 Android adapter/device | User Stories; `DS-006`, `DS-010`, `DS-011` |
| FR4.2 | FR | Derived | Approved | 승인된 `F-TRG-002`–`004`, `F-NOT-005`; 장소 Trigger와 이벤트 조건 | `PR-AC-006`, `016`, `066`; §4 Android adapter/device | User Stories; `DS-006`, `DS-010`, `DS-011` |
| FR4.3 | FR | Derived | Approved | 승인된 `F-NOT-006`–`007`, `F-SET-004`; 알림 설정 및 OS 권한 상태 | `PR-AC-009`, `057`; §4 Android/UI | User Stories; `DS-006`, `DS-007`, `DS-011` |
| FR5 | FR | Derived | Approved | 승인된 목록·이력·보관함 기능을 사용자 조회 흐름으로 묶음 | FR5.1–FR5.3의 PR-AC; §4 history API/UI | User Stories; `DS-002`, `DS-005`, `DS-009` |
| FR5.1 | FR | Derived | Approved | 승인된 `F-LIST-001`–`003`, `F-LIST-005`, 목록 필터·정렬 수용 기준 | `PR-AC-056`, `061`, `063`; §4 UI flow | User Stories; `DS-002`, `DS-005` |
| FR5.2 | FR | Derived | Approved | 승인된 `F-LIST-004`, `F-HIS-001`–`004`; 완료·놓침·건너뜀 및 주요 변경 이력 조회 | `PR-AC-011`, `064`; §4 history API/UI | User Stories; `DS-005`, `DS-009` |
| FR6 | FR | Derived | Approved | 승인된 서버 기준·클라이언트 동기화 아키텍처; 각 플랫폼에서 같은 업무 상태를 쓰고 읽는 데 필요 | FR6.1–FR6.4의 PR-AC; §4 sync/API | User Stories; `DS-002`, `DS-009`, `DS-011` |
| FR6.1 | FR | Derived | Approved | 승인된 `F-CLI-001`–`004`, `F-NOT-004`, `D-011`; 집 안팎의 온라인 서버 접근 및 오프라인 범위 | `PR-AC-007`, `010`; §4 API/UI | User Stories; `DS-002`, `DS-009` |
| FR6.2 | FR | Derived | Approved | 승인된 `F-NOT-004`, `PR-AC-010`; FCM의 역할을 사용자 알림과 분리 | `PR-AC-010`, `NFR-REL-005`; §4 sync/API | User Stories; `DS-009`, `DS-011` |
| FR6.3 | FR | Derived | Approved | 승인된 `F-CLI-003`, `PR-AC-012`; 공유 UI를 Android 전용 API로부터 분리 | `PR-AC-012`; §4 platform adapter | User Stories; `DS-002`, `DS-011` |
| FR7 | FR | Derived | Approved | 승인된 설정·권한·locale 정책을 사용자 및 가구 설정 흐름으로 묶음 | FR7.1–FR7.7의 PR-AC; §4 settings/UI | User Stories; `DS-003`, `DS-007`, `DS-014` |
| FR7.1 | FR | Derived | Approved | 승인된 `F-SET-001`–`004`와 역할별 가구·개인 설정 범위 | `PR-AC-022`, `PR-AC-025`; §4 settings/API | User Stories; `DS-007` |
| FR7.2 | FR | User | Approved | 사용자가 요청한 다국어 설정, `AFR-001` 승격, `D-066`, `D-093`, `Q-065`; 최초 locale 우선순위 승인 | `PR-AC-052`, `D-093`, `Q-065`; §4 locale/UI/API | User Stories; `DS-007`, `DS-014` |
| FR7.3 | FR | Derived | Approved | 승인된 `F-NOT-007`, `F-SET-004`; 설치별 권한·채널 상태를 확인하는 데 필요 | `PR-AC-009`, `057`; §4 Android/UI | User Stories; `DS-007`, `DS-011` |
| FR8 | FR | User | Approved | 사용자가 범위 추가로 명시 승인한 `Q-063`, `D-091`, `F-REM-009` | FR8.1–FR8.3; `PR-AC-069`; §4 domain/API/flow | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.1 | FR | User | Approved | 승인된 `Q-063`·`D-091`; 담당자의 완료 요청을 검증 대기로 전환 | `PR-AC-069`; §4 domain/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.2 | FR | User | Approved | 승인된 `Q-063`·`D-091`; 승인·거절·응답 전 상태를 분리해 회차 완료를 판정 | `PR-AC-069`; §4 state/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.3 | FR | User | Deferred | `Q-063`에 남은 검증자 권한·취소·만료·재알림·전달 정책; 구체 동작은 승인된 결정 전까지 요구하지 않음 | `Q-063`; 후속 상세화 `DS-004`·`DS-005`·`DS-009` | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR9 | FR | User | Approved | 사용자가 범위 추가로 명시 승인한 `Q-064`, `D-092`, `F-OPS-007`–`008` | FR9.1–FR9.3; `PR-AC-070`; §4 operations | User Stories; `DS-008`, `DS-014` |
| FR9.1 | FR | User | Approved | 승인된 `Q-064`·`D-092`; 주간 보고 주기 | `PR-AC-070`; §4 operations | User Stories; `DS-008`, `DS-014` |
| FR9.2 | FR | User | Approved | 승인된 `Q-064`·`D-092`; 선택적 장애 알림 및 감지 시 즉시 전달 | `PR-AC-070`; §4 operations | User Stories; `DS-008`, `DS-014` |
| FR10 | FR | Derived | Approved | 승인된 `F-OPS`·배포·백업 기준을 Raspberry Pi 운영 가능 흐름으로 묶음 | FR10.1–FR10.7의 PR-AC 및 NFR 참조; `docs/08-test-strategy.md` §7 운영 검증 | User Stories; `DS-008`, `DS-009` |
| FR10.1 | FR | Derived | Approved | 승인된 `F-OPS-001`, `F-OPS-004`, `D-077`; 서비스 자동 시작·재시작에 필요 | `PR-AC-062`; §7 RPi operations | User Stories; `DS-008`, `DS-009` |
| FR10.2 | FR | Derived | Approved | 승인된 `F-OPS-002`–`003`, `PR-AC-062`; 공개 관리면 없이 운영 상태와 자원 사용을 확인하는 데 필요 | `PR-AC-062`; §7 RPi operations | User Stories; `DS-008` |
| FR10.3 | FR | Derived | Approved | 승인된 `F-OPS-003`, `NFR-REL-003`; 일관된 backup 생성에 필요 | `PR-AC-031`, `NFR-REL-003`; §7 backup/restore | User Stories; `DS-008`, `DS-009` |
| NFR1 | NFR | Derived | Approved | 승인된 `NFR-SEC-001`–`005`와 접근 수용 기준; household 격리와 안전한 인증을 품질 조건으로 묶음 | NFR1.1–NFR1.4; `PR-AC-001`–`003`, `028`–`031`; §4 API/security | User Stories; `DS-003`, `DS-009`, `DS-014` |
| NFR2 | NFR | Derived | Approved | 승인된 `NFR-SEC-006`, `PR-AC-031`, `043`, `059`; 데이터 최소화·보호 정책 | NFR2.1–NFR2.3; `PR-AC-031`, `043`, `059`; §4 security/privacy | User Stories; `DS-008`, `DS-009`, `DS-014` |
| NFR3 | NFR | Derived | Approved | 승인된 `NFR-REL-001`–`007`; 재시도와 복구에서 중복·부분 적용을 제한 | NFR3.1–NFR3.4; `NFR-REL-001`–`007`; §4 unit/API/operations | User Stories; `DS-006`, `DS-008`–`DS-011`, `DS-014` |
| NFR4 | NFR | Derived | Approved | 승인된 `NFR-TIME-001`–`004`와 시간·반복 기준 | NFR4.1–NFR4.2; `PR-AC-050`–`051`; §4 fake-clock/timezone unit | User Stories; `DS-010`, `DS-014` |
| NFR5 | NFR | Derived | Approved | 승인된 `NFR-PERF-001`–`003`; 소규모 사용의 응답 목표와 RPi 경계 | NFR5.1–NFR5.3; p95 500ms 목표; 합격 측정 범위는 `DS-014`; §4 RPi performance | User Stories; `DS-008`, `DS-014` |
| NFR6 | NFR | User | Approved | 사용자가 요청한 고정 기기 크기 없는 반응형 웹; 승인된 `NFR-UX-001`–`004`, `D-078` | NFR6.1–NFR6.4; `PR-AC-007`, `043`, `063`; 가로 overflow·재배치·키보드·터치 합격 기준은 `DS-014`; §4 viewport/accessibility | User Stories; `DS-002`, `DS-014` |
| NFR7 | NFR | User | Approved | 사용자의 한국어·영어 기본 지원 및 향후 언어 확장 요청, 승인 `AFR-001`, `D-065`–`066`, `D-093`, `Q-065` | NFR7.1–NFR7.5; `NFR-I18N-001`–`002`, `PR-AC-052`; §4 locale/UI/API 및 `DS-014` | User Stories; `DS-007`, `DS-014` |
| NFR8 | NFR | Derived | Approved | 승인된 `PR-AC-012`, `D-006`, `D-008`, `D-053`–`057`; 제품 동작을 플랫폼 경계와 RPi 호환성 안에 유지 | NFR8.1–NFR8.2; `PR-AC-012`; §4 platform adapter/ARM64 compatibility | User Stories; `DS-002`, `DS-014` |
| NFR9 | NFR | User | Approved | 사용자 승인 `D-071`·팀 실천(TDD, 80% line coverage); 문서 정합성은 별도 미해결 과제로 유지 | NFR9.1–NFR9.3; `docs/08-test-strategy.md`와 구현 전 정합화 | User Stories; `DS-014`, `docs/08-test-strategy.md` §4 |
| NFR10 | NFR | Derived | Approved | 승인된 `PR-AC-062`, `D-077`, `NFR-REL-007`; 운영 상태 확인과 노출 경계에 필요 | NFR10.1–NFR10.2; `PR-AC-062`, `NFR-REL-007`; §7 operations/security | User Stories; `DS-008`, `DS-014` |
+| FR1.5 | FR | Derived | Approved | 승인된 `F-ACC-006`, `PR-AC-029`~`PR-AC-030`; 외부 인증 신원과 내부 업무 ID를 분리 | `PR-AC-029`~`PR-AC-030`; §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR1.6 | FR | Derived | Approved | 승인된 `D-074`, `F-HH-001`, `PR-AC-058`; 최초 Admin의 일회성 bootstrap | `PR-AC-058`; §4 household/API | User Stories; `DS-003` |
| FR1.7 | FR | Derived | Approved | 승인된 `F-HH-002`, `D-023`~`D-029`; 초대 링크를 통한 구성원 가입 | `PR-AC-028`~`PR-AC-029`; §4 초대/API | User Stories; `DS-003` |
| FR1.8 | FR | Derived | Approved | 승인된 `F-HH-003`, `D-020` 및 역할 매트릭스; 역할별 가구 기능 권한 | `PR-AC-025`~`PR-AC-026`; §4 authorization/API | User Stories; `DS-003`, `DS-009` |
| FR2.4 | FR | Derived | Approved | 승인된 `F-REM-001`, `F-HIS-001`, `D-012`~`D-013`; 담당자와 요청자 관계 구분 | `PR-AC-013`~`PR-AC-015`, `PR-AC-055`; §4 Reminder API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.5 | FR | Derived | Approved | 승인된 `F-REM-004`, `D-032`~`D-033`; Reminder 보관 동작 | `PR-AC-034`; §4 Reminder API/UI | User Stories; `DS-004`, `DS-005` |
| FR2.6 | FR | Derived | Approved | 승인된 `F-REM-004`, `D-032`, `D-084`; 되돌릴 수 없는 삭제 확인 | `PR-AC-035`, `PR-AC-065`; §4 Reminder API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.7 | FR | Derived | Approved | 승인된 `F-HIS-001`, `F-HIS-004`, `D-013`, `D-037`; 실제 행위자와 변경 이력 보존 | `PR-AC-014`~`PR-AC-015`; §4 history API | User Stories; `DS-005`, `DS-009` |
| FR2.8 | FR | Derived | Approved | 승인된 `F-REM-003`, `PR-AC-002`; Reminder 수정 권한 | `PR-AC-002`; §4 core API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.9 | FR | Derived | Approved | 승인된 `F-REM-005`, `PR-AC-003`; 완료 취소 흐름 | `PR-AC-003`; §4 domain/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.10 | FR | Derived | Approved | 승인된 `F-REM-004`, `D-032`~`D-034`; 보관된 Reminder 복원 | `PR-AC-034`; §4 Reminder API/UI | User Stories; `DS-004`, `DS-005` |
| FR3.4 | FR | Derived | Approved | 승인된 `F-REC-008`, `D-060`; 무담당 반복의 일시 중지·재개 | `D-060`, `PR-AC-013`; §4 recurrence/domain | User Stories; `DS-006`, `DS-010` |
| FR3.5 | FR | Derived | Approved | 승인된 `D-033`; 보관 중 반복 생성 중단 및 복원 후 재개 | `PR-AC-034`; §4 recurrence/fake-clock | User Stories; `DS-006`, `DS-010` |
| FR3.6 | FR | Derived | Approved | 승인된 `D-034`; 보관 전 pending 회차의 복원 처리 | `PR-AC-034`; §4 recurrence/fake-clock | User Stories; `DS-006`, `DS-010` |
| FR3.7 | FR | Derived | Approved | 승인된 `F-REC-006`, `D-075`; 현재 회차만 수동 건너뛰기 | `PR-AC-060`; §4 recurrence/domain | User Stories; `DS-006`, `DS-010` |
| FR4.4 | FR | Derived | Approved | 승인된 `D-026`; 잠금 화면 알림의 개인정보 공개 범위 | `PR-AC-059`; §4 Android notification | User Stories; `DS-006`, `DS-011` |
| FR4.5 | FR | Derived | Approved | 승인된 `F-NOT-009` 및 동기화 기준; 유효하지 않은 회차의 설치 예약 정리 | `PR-AC-008`~`PR-AC-010`; §4 device reconcile | User Stories; `DS-006`, `DS-011` |
| FR4.6 | FR | Derived | Approved | 승인된 `D-044`; 위치 권한 거부 시에도 저장을 허용하고 해당 설치 상태를 안내 | `PR-AC-009`; §4 Android permission | User Stories; `DS-006`, `DS-011` |
| FR4.7 | FR | Derived | Approved | 승인된 `D-045`와 `PR-AC-013`; 담당자에게 연결된 설치만 알림 대상 | `PR-AC-013`; §4 device targeting | User Stories; `DS-006`, `DS-011` |
| FR4.8 | FR | Derived | Approved | 승인된 `D-090`; geofence 용량을 넘기는 생성·담당자 변경 차단과 재시도 안내 | `PR-AC-068`; §4 Android adapter/device | User Stories; `DS-006`, `DS-011` |
| FR5.3 | FR | Derived | Approved | 승인된 `F-LIST-008`, `D-032`; 보관된 Reminder 목록 조회 | `PR-AC-034`; §4 archive API/UI | User Stories; `DS-002`, `DS-005` |
| FR6.4 | FR | Derived | Approved | 승인된 `F-NOT-004`, `PR-AC-008`; 앱·기기·권한 상태 변화 뒤 설치별 Trigger 조정 | `PR-AC-008`, `NFR-REL-005`~`NFR-REL-006`; §4 Android sync | User Stories; `DS-009`, `DS-011` |
| FR7.4 | FR | Derived | Approved | 승인된 `D-065`~`D-066`; 날짜·시간·숫자 표현의 locale/time zone 기준 | `PR-AC-051`~`PR-AC-052`; §4 UI/API | User Stories; `DS-007`, `DS-014` |
| FR7.5 | FR | Derived | Approved | 승인된 `D-065` 및 locale-neutral API 결정; 사용자 작성 Reminder 내용 보존 | `PR-AC-052`; §4 UI/API; `ADR-034` | User Stories; `DS-007`, `DS-014` |
| FR7.6 | FR | Derived | Approved | 승인된 `F-SET-005`, `D-019`; 선택 기능 설정 규칙을 한 카탈로그로 관리 | `PR-AC-023`~`PR-AC-024`; §4 settings/API | User Stories; `DS-007` |
| FR7.7 | FR | Derived | Approved | 승인된 `D-073`; 기기별 권한·알림 채널 설정은 Android OS에서 관리 | `PR-AC-009`, `PR-AC-057`; §4 Android/UI | User Stories; `DS-007`, `DS-011` |
| FR9.3 | FR | User | Deferred | `Q-064`에 열린 운영자·보고·장애판정·전달 정책; 승인된 범위는 주간 보고와 즉시 알림 기능의 포함에 한함 | `Q-064`; 후속 상세화 `DS-008`, `DS-014`; 미결정 값은 합격 조건으로 사용하지 않음 | User Stories; `DS-008`, `DS-014` |
| FR10.4 | FR | Derived | Approved | 승인된 `F-OPS-005`, `NFR-REL-003`; 업데이트와 migration 실패 시 운영 데이터 보호 | `docs/06-deployment-and-operations.md`; §7 migration/restore | User Stories; `DS-008`, `DS-009` |
| FR10.5 | FR | Derived | Approved | 승인된 `NFR-SEC-006`, `D-025`; 별도 보관 백업 암호화와 복구 key 분리 | `PR-AC-031`, `NFR-SEC-006`; §7 backup/restore | User Stories; `DS-008`, `DS-014` |
| FR10.6 | FR | Derived | Approved | 승인된 `F-OPS-002`, `D-077`; 애플리케이션 로그를 journald에서 확인 가능 | `PR-AC-062`; §7 RPi operations | User Stories; `DS-008` |
| FR10.7 | FR | Derived | Approved | 승인된 `F-OPS-003`, `NFR-REL-003`; 별도 백업에서 데이터 복구 | `PR-AC-031`, `NFR-REL-003`; §7 backup/restore | User Stories; `DS-008`, `DS-009` |
| NFR1.1 | NFR | Derived | Approved | 승인된 `NFR-SEC-002`; 보호된 API 접근에 인증과 세션 처리가 필요 | `PR-AC-001`, `PR-AC-028`~`PR-AC-030`; §4 auth/API | User Stories; `DS-003`, `DS-009` |
| NFR1.2 | NFR | Derived | Approved | 승인된 `NFR-SEC-001`; 가구 소속과 역할을 요청마다 검증 | `PR-AC-002`~`PR-AC-003`, `PR-AC-025`~`PR-AC-026`; §4 auth/API | User Stories; `DS-003`, `DS-009` |
| NFR1.3 | NFR | Derived | Approved | 승인된 `NFR-SEC-003`; household 간 데이터 접근 차단 | `PR-AC-001`~`PR-AC-003`; §4 tenant isolation/API | User Stories; `DS-003`, `DS-009` |
| NFR1.4 | NFR | Derived | Approved | 승인된 `NFR-SEC-004`~`NFR-SEC-005`; 초대·기기 자격 증명 보호 | `PR-AC-028`~`PR-AC-031`; §4 credential handling | User Stories; `DS-003`, `DS-009`, `DS-011` |
| NFR2.1 | NFR | Derived | Approved | 승인된 `NFR-SEC-006`와 `D-043`; 필요한 개인 일정·위치 데이터만 수집 | `PR-AC-043`; `docs/07-security-and-privacy.md` §4~§5 | User Stories; `DS-008`, `DS-009` |
| NFR2.2 | NFR | Derived | Approved | 승인된 `D-026`; 잠금 화면에서 허용된 공개 수준만 표시 | `PR-AC-059`; `docs/07-security-and-privacy.md` §4 | User Stories; `DS-006`, `DS-011` |
| NFR2.3 | NFR | Derived | Approved | 승인된 `NFR-SEC-006`; 감사 이력과 계정 데이터의 접근·보존은 기준 문서를 따른다 | `docs/07-security-and-privacy.md` §5; `D-031`, `D-068` | User Stories; `DS-008`, `DS-009` |
| NFR3.1 | NFR | Derived | Approved | 승인된 `NFR-REL-001`, `NFR-REL-003`; 연관 저장 변경의 원자성 | `docs/08-test-strategy.md` §4 API·DB integration; §4 unit/API | User Stories; `DS-004`, `DS-009`, `DS-014` |
| NFR3.2 | NFR | Derived | Approved | 승인된 `NFR-REL-004`; 반복 회차 생성의 중복 방지 | `PR-AC-032`; §4 recurrence/fake-clock | User Stories; `DS-006`, `DS-010` |
| NFR3.3 | NFR | Derived | Approved | 승인된 `NFR-REL-005`; FCM 변경 신호의 재시도·중복 처리 | `PR-AC-010`; §4 sync/API | User Stories; `DS-009`, `DS-011` |
| NFR3.4 | NFR | Derived | Approved | 승인된 `NFR-REL-003`; 운영 데이터 복구 절차를 사용할 수 있어야 함 | `PR-AC-031`; `docs/06-deployment-and-operations.md` 및 `docs/08-test-strategy.md` §7 | User Stories; `DS-008`, `DS-014` |
| NFR4.1 | NFR | Derived | Approved | 승인된 `NFR-TIME-001`; 영속 instant는 UTC 기준 | `PR-AC-050`; §4 fake-clock/timezone unit | User Stories; `DS-010`, `DS-014` |
| NFR4.2 | NFR | Derived | Approved | 승인된 `NFR-TIME-002`; 반복 규칙과 지역 시각 계산에 IANA time zone 사용 | `PR-AC-050`~`PR-AC-051`; §4 fake-clock/timezone unit | User Stories; `DS-010`, `DS-014` |
| NFR5.1 | NFR | Derived | Approved | 승인된 `NFR-PERF-001`; 소규모 가정 내 사용의 주요 화면 응답 목표 | p95 500ms; 합격 측정 범위는 `DS-014`; §4 RPi performance | User Stories; `DS-008`, `DS-014` |
| NFR5.2 | NFR | Derived | Approved | 승인된 `NFR-PERF-002`; Raspberry Pi의 제한된 메모리 자원 고려 | `PR-AC-044`; §4 RPi performance | User Stories; `DS-008`, `DS-014` |
| NFR5.3 | NFR | Derived | Approved | 승인된 `NFR-PERF-003`; MVP 단일 노드 운영 형태 | `PR-AC-044`; §4 RPi deployment/performance | User Stories; `DS-008`, `DS-014` |
| NFR6.1 | NFR | User | Approved | 사용자가 고정 화면 크기를 정하지 않는 유동적 반응형 웹을 요청 | `NFR-UX-001`, `PR-AC-007`, `PR-AC-043`; `docs/08-test-strategy.md` §4의 대표 뷰포트·가로 overflow 확인 | User Stories; `DS-002`, `DS-014` |
| NFR6.2 | NFR | Derived | Approved | 승인된 접근성 기준; 주요 사용자 흐름을 키보드와 터치로 조작 | `NFR-UX-002`, `PR-AC-007`, `PR-AC-043`; §4 Web UI 흐름 | User Stories; `DS-002`, `DS-014` |
| NFR6.3 | NFR | Derived | Approved | 승인된 `NFR-UX-003`; 상태 표현은 색상 외 단서를 포함 | `PR-AC-063`; §4 Web UI 흐름 | User Stories; `DS-002`, `DS-014` |
| NFR6.4 | NFR | Derived | Approved | 승인된 `NFR-UX-004`; 권한 거부가 기본 Reminder 관리 기능을 막지 않음 | `PR-AC-009`, `PR-AC-057`; §4 Web UI/Android permission | User Stories; `DS-006`, `DS-011` |
| NFR7.1 | NFR | User | Approved | 사용자가 한국어·영어 기본 지원과 향후 언어 확장을 요청 | `PR-AC-052`, `NFR-I18N-001`; §4 localization/UI | User Stories; `DS-007`, `DS-014` |
| NFR7.2 | NFR | Derived | Approved | 승인된 `D-093`, `Q-065`; 저장 locale, 지원 기기 locale, `ko-KR` 기본값의 우선순위 | `PR-AC-052`; §4 locale selection | User Stories; `DS-007`, `DS-014` |
| NFR7.3 | NFR | Derived | Approved | 승인된 `D-065`~`D-066`; locale과 시간대에 맞춘 날짜·시간·숫자·복수형 표현 | `PR-AC-052`; §4 localization/UI | User Stories; `DS-007`, `DS-014` |
| NFR7.4 | NFR | Derived | Approved | 승인된 locale-neutral API 경계; 서버 응답을 locale 문장과 분리 | `ADR-034`, `NFR-I18N-001`; §4 API integration | User Stories; `DS-007`, `DS-014` |
| NFR7.5 | NFR | Derived | Approved | 승인된 `D-065`; 사용자 작성 Reminder 내용은 자동 번역하지 않고 보존 | `PR-AC-052`, `ADR-034`; §4 localization/UI/API | User Stories; `DS-007`, `DS-014` |
| NFR8.1 | NFR | Derived | Approved | 승인된 `D-006`, `D-008`, `D-052`; 도메인과 공유 UI의 플랫폼 중립 경계 | `PR-AC-012`; §4 platform adapter/API | User Stories; `DS-002`, `DS-011` |
| NFR8.2 | NFR | Derived | Approved | 승인된 Raspberry Pi 배포 기술 경계 `D-053`~`D-057`; ARM64 호환 확인 | `docs/08-test-strategy.md` §7 운영 smoke; 구현 착수 시 호환성 검증 | User Stories; `DS-008`, `DS-014` |
| NFR9.1 | NFR | User | Approved | 사용자가 확정한 `D-071` 및 TDD team practice; 동작 변경 테스트를 먼저 작성 | `D-071`, `team-practices.md`; §4 test-first workflow | User Stories; `DS-014`, `docs/08-test-strategy.md` §2 |
| NFR9.2 | NFR | Derived | Approved | 승인된 team testing practice; 변경 동작과 주요 위험을 자동 검증 | `docs/08-test-strategy.md` §§3~5; 관련 PR-AC 테스트 | User Stories; `DS-014`, `docs/08-test-strategy.md` |
| NFR9.3 | NFR | User | Approved | 사용자가 승인한 80% 전체 line coverage 목표; 기준 문서와 문구 충돌은 구현 전 해결 대상으로 열어 둠 | 80% line coverage; `team-practices.md`; 구현 전 `docs/08-test-strategy.md` 정합화 | User Stories; `DS-014`, `docs/08-test-strategy.md` §4 |
| NFR10.1 | NFR | Derived | Approved | 승인된 `PR-AC-062`, `D-077`; 서비스 상태·오류·백업 진단 | `PR-AC-062`; `docs/08-test-strategy.md` §7 운영 검증 | User Stories; `DS-008`, `DS-014` |
| NFR10.2 | NFR | Derived | Approved | 승인된 ingress 경계; 로컬 헬스체크는 Caddy 공개 경로에서 접근할 수 없음 | `PR-AC-062`; `docs/07-security-and-privacy.md` §2.3, §6 | User Stories; `DS-008`, `DS-014` |

## 추적성 상태 해석

위 등록부의 `Approved`는 정책 근거의 수용 상태다. 구현·사용자 스토리·상세 설계·테스트 연결 상태는 별도의 `traceability.json`과 `docs/09-feature-design-coverage-and-backlog.md`가 관리하며, 아직 존재하지 않는 후속 산출물을 완료로 표시하지 않는다.
