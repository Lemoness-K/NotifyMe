---
layout: review
title: "Notify Me 요구사항"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/requirements-analysis/requirements.md"
permalink: "/reviews/261115-notify-me-implementation/requirements-analysis/20261117-031403411748/01-requirements/"
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

## 기능 요구사항

### 계정과 가구

- **FR1** — 사용자는 인증된 계정으로 Notify Me에 접속하고, 같은 가구의 다른 구성원과 공유된 데이터에 접근한다.
  - **FR1.1** — MVP는 Firebase Authentication의 Google 로그인을 사용하고 외부 인증 신원을 내부 사용자 ID에 연결한다. (`F-ACC-001`, `F-ACC-005`~`F-ACC-006`, `PR-AC-001`, `PR-AC-028`~`PR-AC-030`)
  - **FR1.2** — 서비스는 하나의 가구와 최초 Admin을 초기화하며, Admin 초대를 통해 구성원을 가입시킨다. 역할·초대·구성원 관리 권한은 기존 기준을 따른다. (`F-HH-001`~`F-HH-003`, `F-HH-005`, `PR-AC-027`~`PR-AC-029`, `PR-AC-058`)
  - **FR1.3** — 가구 구성원은 기존 권한 매트릭스에 따라 Reminder를 공동 관리한다. 계정·가구 삭제, 다중 가구 UI 등 후속 기능은 이번 작업에 포함하지 않는다. (`PR-AC-002`~`PR-AC-003`, `docs/01-product-requirements.md` §4, `D-068`)
  - **FR1.4** — 사용자는 현재 설치에서 명시적으로 로그아웃할 수 있다. 로그아웃 또는 현재 세션의 만료·취소가 반영되면 해당 설치의 인증 상태가 종료되고, 다시 로그인할 때까지 사용자·가구 데이터에 대한 인증 접근을 허용하지 않는다. 클라이언트 자격 증명 제거, 서버 측 세션·토큰 취소, 해당 설치의 등록·예약 정리 방식은 상세 설계 `DS-003`에서 구체화한다. (`F-ACC-002`, `NFR-SEC-002`, `docs/07-security-and-privacy.md` §2.2)

### Reminder와 회차

- **FR2** — 가구 구성원은 부탁을 Reminder로 등록하고, 변경·수행·보관 및 삭제를 관리한다.
  - **FR2.1** — Reminder에는 필수 제목과 선택 설명, 작성자·요청자·한 명 이상의 담당자, 필요 시 시간 또는 장소 Trigger와 반복 규칙을 기록한다. 생성·수정 기본값과 유효성 규칙은 기존 결정 및 수용 기준을 따른다. (`F-REM-001`~`F-REM-003`, `PR-AC-013`, `PR-AC-055`)
  - **FR2.2** — 구성원은 Reminder를 조회·수정·보관·복원·영구 삭제할 수 있다. 영구 삭제는 복구 불가 안내와 명시적 확인을 요구한다. (`F-REM-002`~`F-REM-004`, `PR-AC-002`, `PR-AC-034`~`PR-AC-035`, `PR-AC-065`)
  - **FR2.3** — 검증 기능이 꺼진 Reminder의 회차는 기존 정책에 따라 가구 구성원이 완료하거나 완료 취소할 수 있으며, 실제 수행자와 변경 이력을 보존한다. (`F-REM-005`, `F-HIS-001`, `F-HIS-004`, `PR-AC-003`, `PR-AC-014`~`PR-AC-015`)

- **FR3** — 시스템은 반복 규칙과 개별 Occurrence를 관리한다.
  - **FR3.1** — 반복 규칙은 MVP에서 일·주·월 단위 규칙과 선택 종료일을 지원하며, 회차 완료·놓침·건너뜀과 보관·복원 동작은 기존 기준을 따른다. (`F-REC-001`~`F-REC-006`, `F-REC-008`, `PR-AC-011`, `PR-AC-032`, `PR-AC-046`~`PR-AC-050`, `PR-AC-060`, `PR-AC-067`)
  - **FR3.2** — 반복 편집은 이번 회차와 이후 또는 전체 반복 등 기존에 정한 적용 범위를 지원한다. 회차 생성은 중복에 대해 멱등적이어야 한다. (`F-REC-005`~`F-REC-006`, `D-063`, `NFR-REL-004`)
  - **FR3.3** — 상태 흐름, 무담당 반복, 보관된 반복, 취소·복원 및 수동 건너뛰기는 기존 결정과 연결된 수용 기준을 따른다. (`F-REC-008`, `F-REM-007`~`F-REM-008`, `PR-AC-033`~`PR-AC-037`, `PR-AC-060`)

### 알림, 동기화, 목록과 기록

- **FR4** — 사용자는 시간·장소 조건에 따라 Android 시스템 알림을 받는다.
  - **FR4.1** — 서버에 저장한 시간 Trigger를 대상 Android 기기에 로컬 예약하고, 앱 UI가 보이지 않아도 OS 권한이 허용된 경우 알림을 표시한다. 정확 알람 권한, 지연 허용, 재부팅 복구 및 중복 억제는 기존 결정을 따른다. (`F-TRG-001`, `F-NOT-002`~`F-NOT-003`, `PR-AC-004`~`PR-AC-005`, `PR-AC-008`)
  - **FR4.2** — 장소 Trigger는 저장한 장소와 반경 및 선택한 진입·이탈·머무름·이탈 후 경과 조건에 따라 대상 Android 기기에서 처리한다. 위치 권한 거부와 geofence 용량 초과는 기존의 서로 다른 처리 정책을 따른다. (`F-TRG-002`~`F-TRG-004`, `F-NOT-005`, `PR-AC-006`, `PR-AC-009`, `PR-AC-016`, `PR-AC-066`, `PR-AC-068`)
  - **FR4.3** — 알림 설정 상태, OS 권한 이동, 잠금 화면 공개 정책, 취소된 회차의 예약 해제 및 담당자 기기 대상은 기존 수용 기준을 따른다. (`F-NOT-006`~`F-NOT-007`, `F-NOT-009`, `F-SET-004`, `PR-AC-009`, `PR-AC-057`, `PR-AC-059`)

- **FR5** — 사용자는 활성 할 일, 완료 이력 및 보관함을 조회한다.
  - **FR5.1** — 활성 목록은 내 할 일·내가 요청한 일·가구 전체 보기와 기한 초과·오늘·예정 분류를 기존 정렬·필터 규칙으로 제공한다. (`F-LIST-001`~`F-LIST-003`, `F-LIST-005`, `PR-AC-056`, `PR-AC-061`, `PR-AC-063`)
  - **FR5.2** — 완료·놓침·건너뜀 및 주요 변경 이력을 저장하고, 사용자가 담당 Reminder 또는 가구 전체 범위로 조회한다. 보관함은 보관된 Reminder의 조회·복원을 제공한다. (`F-LIST-004`, `F-LIST-008`, `F-HIS-001`~`F-HIS-004`, `PR-AC-011`, `PR-AC-034`, `PR-AC-064`)

- **FR6** — 서버는 공유 데이터의 기준 시스템이며 연결된 클라이언트와 Android 설치는 최신 상태를 동기화한다.
  - **FR6.1** — 브라우저와 Android 앱은 집 안팎에서 HTTPS로 서버를 조회·변경한다. MVP는 오프라인 편집과 충돌 해결을 제공하지 않는다. (`F-CLI-001`~`F-CLI-004`, `F-NOT-004`, `PR-AC-007`, `PR-AC-010`, `D-011`)
  - **FR6.2** — FCM은 사용자에게 보이는 알림이 아닌 변경 신호로 사용하며, 앱 재시작·기기 재부팅·권한 변경 후 로컬 예약과 지오펜스를 멱등하게 reconcile한다. (`F-NOT-004`, `PR-AC-008`, `PR-AC-010`, `NFR-REL-005`~`NFR-REL-006`)
  - **FR6.3** — 공유 UI와 도메인은 Android SDK에 직접 의존하지 않고 플랫폼 중립 인터페이스를 통해 알림·예약·지오펜스·권한 기능을 사용한다. (`F-CLI-003`, `PR-AC-012`)

### 설정과 선택 기능

- **FR7** — 사용자는 개인·가구 설정과 설치별 권한·기능 상태를 관리한다.
  - **FR7.1** — Admin은 가구 공통 설정을, 구성원은 허용된 개인 설정을 관리한다. 선택 기능은 기본값·범위·비활성화·제거 동작을 선언하는 설정 카탈로그에 등록한다. (`F-SET-001`~`F-SET-007`, `PR-AC-022`~`PR-AC-024`, `PR-AC-066`~`PR-AC-067`)
  - **FR7.2** — 사용자는 개인 설정에서 UI 언어를 선택하며 선택값은 서버에 저장되어 해당 사용자의 다른 설치와 동기화된다. 유효한 저장 선택은 기기 locale보다 우선한다. 저장 선택이 없거나 더 이상 지원되지 않으면 지원되는 기기 locale을 사용하고, 기기 locale도 지원되지 않으면 기본값 `ko-KR`을 사용한다. MVP 지원 locale은 한국어(`ko-KR`)와 영어(`en-US`)다. 날짜·시간·숫자는 사용자 locale과 시간대에 맞춰 표시하고, 사용자가 작성한 Reminder 제목·내용은 번역하거나 변경하지 않는다. 일정 계산은 저장된 IANA 시간대와 가구·반복 규칙 설정을 따른다. (`F-ACC-003`, `F-SET-003`, `PR-AC-051`~`PR-AC-052`, `D-065`~`D-066`, `D-093`, `Q-065`, `AFR-001`)
  - **FR7.3** — 기기별 알림·위치 권한 및 채널 상태를 표시하고 OS 설정으로 이동할 수 있다. 권한이 없어도 기본 업무 관리 기능을 사용할 수 있다. (`F-NOT-007`, `F-SET-004`, `PR-AC-009`, `PR-AC-057`)

### 승인된 MVP 범위 추가

- **FR8** — 사용자는 Reminder별 선택적 완료 검증을 설정할 수 있다. (`F-REM-009`, `Q-063`, `D-091`, `PR-AC-069`)
  - **FR8.1** — 검증이 켜진 Reminder에서 담당자가 회차 완료를 표시하면 회차는 검증 대기 상태가 되고, 지정된 다른 가구 구성원이 검증한다.
  - **FR8.2** — 지정 검증자의 승인은 회차를 완료로 확정하고, 거절은 미완료 상태로 되돌린다. 검증 응답 전에는 대기 상태를 유지한다.
  - **FR8.3** — 검증자 자격·권한 경계, 여러 담당자·검증자 상호작용, 요청 취소·만료·재알림 및 상세 화면·데이터 규칙은 후속 상세 설계에서 결정한다. 검증자 알림의 필요성과 전달 방식도 그때 확정한다.

- **FR9** — 운영자는 선택 기능으로 주간 운영 보고와 장애 발생 즉시 알림을 받을 수 있다. (`F-OPS-007`~`F-OPS-008`, `Q-064`, `D-092`, `PR-AC-070`)
  - **FR9.1** — 운영 보고는 매주 제공하고, 장애 알림은 장애가 감지되면 즉시 제공한다.
  - **FR9.2** — 운영자 자격, 보고 내용·기준 시간대, 장애 신호·판정·중복 억제, 전달 채널·재시도 및 기능별 활성화 방식은 상세 설계에서 확정한다. 별도 사용자 승인 없이 비용이나 외부 사업자 계정이 필요한 전달 방식을 선택하지 않는다.

### 운영

- **FR10** — 제품은 Raspberry Pi MVP 배포를 위한 운영·복구 수단을 제공한다.
  - **FR10.1** — NestJS API·Worker는 systemd로 자동 시작·재시작하며 앱 로그를 journald에서 확인할 수 있다. (`F-OPS-001`~`F-OPS-002`, `F-OPS-004`, `PR-AC-062`)
  - **FR10.2** — 운영자는 공개 경로에 노출되지 않는 로컬 헬스체크, 서비스 상태, 로그, 디스크·메모리와 백업 결과를 확인할 수 있다. MVP에는 운영 대시보드를 두지 않는다. (`F-OPS-002`~`F-OPS-004`, `PR-AC-062`)
  - **FR10.3** — SQLite 데이터의 일관된 백업·복구, 안전한 업데이트와 DB migration 절차를 설계하고 검증한다. 별도 보관 백업은 암호화하고 복구 key를 분리한다. (`F-OPS-003`, `F-OPS-005`, `PR-AC-031`, `NFR-REL-003`, `NFR-SEC-006`)

## 비기능 요구사항

- **NFR1** — 모든 데이터 접근은 인증과 서버 측 가구·역할 권한 검사를 거쳐야 한다. 서로 다른 가구의 데이터는 격리하고, 세션·초대·기기 자격 증명은 안전하게 처리한다. (`NFR-SEC-001`~`NFR-SEC-005`, `PR-AC-001`~`PR-AC-003`, `PR-AC-028`~`PR-AC-031`)
- **NFR2** — 개인 일정, 위치 및 가구 데이터는 최소 수집·보존 원칙을 따르고, 잠금 화면·감사 이력·계정 데이터에서 기존 개인정보 정책을 지킨다. (`NFR-SEC-006`, `PR-AC-031`, `PR-AC-043`, `PR-AC-059`)
- **NFR3** — DB transaction, 반복 회차 생성, 알림 전달과 설치별 예약 reconcile은 재시도·재시작 시 중복 또는 부분 적용을 제한해야 한다. 운영 복구는 문서화되고 백업에서 검증 가능해야 한다. (`NFR-REL-001`~`NFR-REL-007`)
- **NFR4** — 일정 시각은 UTC instant와 명시적 IANA time zone을 구분해 저장·계산·표시한다. DST와 기기·서버 시간 변경에 대한 동작은 기존 결정과 테스트 전략을 따른다. (`NFR-TIME-001`~`NFR-TIME-004`, `PR-AC-050`~`PR-AC-051`)
- **NFR5** — 주요 서버 화면 응답은 가정 내 소규모 사용에서 p95 500ms 이하를 목표로 한다. MVP는 Raspberry Pi 자원 제약과 단일 노드 복구성을 고려한다. (`NFR-PERF-001`~`NFR-PERF-003`)
- **NFR6** — Web UI는 특정 기기 종류나 고정 모바일 너비에 종속되지 않고, 가용 뷰포트에 맞춰 유동적으로 재배치되어 다양한 화면 크기와 방향을 수용해야 한다. 주요 흐름은 가로 넘침 없이 키보드와 터치로 조작할 수 있고 상태를 색상만으로 구분하지 않는다. 알림·위치 권한이 거부되어도 기본 업무 기능을 사용할 수 있다. `DS-002`에서 정할 360 CSS px 등의 대표 테스트 너비는 지원 가능한 화면의 최소 경계가 아니다. (`NFR-UX-001`~`NFR-UX-004`)
- **NFR7** — UI와 시스템 생성 문구는 번역 키와 locale resource로 분리한다. 유효한 사용자별 저장 locale을 기기 locale보다 우선하고, 저장 선택이 없거나 지원되지 않을 때는 지원되는 기기 locale을 사용하며 둘 다 지원되지 않으면 `ko-KR`을 기본값으로 적용한다. MVP locale은 `ko-KR`과 `en-US`다. 새 언어는 도메인 데이터나 업무 규칙 변경 없이 locale resource를 추가해 지원할 수 있어야 한다. 날짜·시간·숫자·복수형은 사용자 locale과 시간대에 따라 표현하고, API는 번역 문구 대신 locale-neutral한 오류 코드·enum·구조화 값을 반환하며, 사용자 작성 값은 자동 번역하지 않는다. (`NFR-I18N-001`~`NFR-I18N-002`, `PR-AC-052`, `D-065`~`D-066`, `D-093`, `Q-065`, `AFR-001`)
- **NFR8** — 도메인·공유 UI는 플랫폼 SDK에 직접 결합하지 않는다. 계획된 기술 스택과 native dependency의 Raspberry Pi ARM64 호환성을 구현 착수 시 검증한다. (`PR-AC-012`, `D-006`, `D-008`, `D-053`~`D-057`)
- **NFR9** — 팀은 TDD, 위험 기반 자동 테스트, CI를 적용하고 전체 라인 커버리지 80% 목표를 둔다. 이 목표와 `docs/08-test-strategy.md`의 고정 전체 커버리지 기준 미사용 문구가 충돌하므로, 구현 전 테스트 기준 문서를 정합화한다. (`D-071`, Practices Discovery `team-practices.md`, `docs/08-test-strategy.md`)
- **NFR10** — 서비스 오류·상태·백업 결과는 운영자가 명령과 로그로 진단할 수 있어야 하며, 로컬 헬스체크·비밀값·관리 포트가 공개 ingress를 통해 노출되지 않아야 한다. (`PR-AC-062`, `D-077`, `NFR-REL-007`)

## 시나리오 및 경계 조건 검토

| 적용 조건 | 처리 위치 |
|---|---|
| 첫 실행, 로그인·세션 만료, 가구·역할 경계 | `FR1.1`~`FR1.4`, `FR1.2`, `NFR1`; 인증·초대·가구 예외 흐름은 `DS-003`에서 상세화한다. |
| Reminder 입력·수정·보관·영구 삭제, 완료와 검증 | `FR2.1`~`FR2.3`, `FR8.1`~`FR8.3`; 필드 경계·오류 문구·취소 상태는 `DS-004`·`DS-005`에서 상세화한다. 영구 삭제 확인은 기존 `PR-AC-065`를 따른다. |
| 빈 목록·다수 항목·오류·응답 지연, 화면별 상태 표현 | 목록 범위는 `FR5.1`~`FR5.2`; 로딩·빈·오류·재시도 및 페이지 표현은 `DS-002`·`DS-005`·`DS-009`에서 상세화한다. MVP의 완전한 오프라인 편집과 충돌 해결은 제외한다(`FR6.1`). |
| 반복의 날짜 경계·시간대·DST·중복 실행 | `FR3.1`~`FR3.3`, `NFR3`~`NFR4`; 기존 결정과 테스트 범위를 따르고 반복 anchor 및 예외 상호작용은 `DS-010`에서 상세화한다. |
| 권한 거부, 기기 재시작, 예약·지오펜스 용량 및 동기화 재시도 | `FR4.1`~`FR4.3`, `FR6.2`, `NFR3`; 권한 거부와 용량 초과는 서로 다른 승인 정책을 따르며 설치별 복구 흐름은 `DS-006`·`DS-011`에서 상세화한다. |
| 반응형 재배치, 키보드·터치, 비색상 상태 표시, 다양한 locale의 문구·날짜·숫자 | `NFR6`~`NFR7`, `FR7.2`; 화면 배치 및 대표 viewport 검증은 `DS-002`·`DS-014`에서 정하며 대표 테스트 값은 제품의 최소 지원 경계를 뜻하지 않는다. 사용자 작성 내용은 자동 번역하지 않는다. |
| 동시 변경, 반복 작업 재실행, 저장·백업·복구, 운영 진단 | `FR6.2`, `FR10.1`~`FR10.3`, `NFR2`~`NFR3`, `NFR10`; 동시성·원자성·운영 복구 기준은 `DS-008`·`DS-009`·`DS-014`와 테스트 전략에서 상세화한다. |
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

이 등록부는 요구사항 유형, 기원, 정책 상태, 출처 또는 도출 근거, 검증 기준, 후속 추적 대상을 요구사항 ID별로 기록한다. `Approved`는 해당 제품 동작이나 품질 제약의 근거 정책이 프로젝트에서 승인됐음을 뜻하며, 추적 커버리지 상태(`OK`, `GAP` 등)와는 별개다. `Derived` 항목은 출처 ID를 요구사항 본문에 연결하고, 부모 요구를 검증 가능한 동작으로 분해하거나 승인된 불변식을 만족하는 데 필요한 이유를 아래에 적었다. 명시적으로 승인되지 않은 AI 제안은 정식 요구사항으로 포함하지 않는다.

| ID | Type | Origin | Status | Source / derivation | Acceptance / verification | Downstream traceability |
|---|---|---|---|---|---|---|
| FR1 | FR | Derived | Approved | 사용자 목표와 승인된 `F-ACC`·`F-HH` 정책을 인증·가구 접근 흐름으로 묶음 | FR1.1–FR1.4의 PR-AC; `docs/08-test-strategy.md` §4 인증/API | User Stories 다음 단계; `DS-003`, `DS-009` |
| FR1.1 | FR | Derived | Approved | 승인된 `F-ACC-001`, `F-ACC-005`–`F-ACC-006`, `PR-AC-001`, `PR-AC-028`–`030`에서 인증 경계 도출 | `PR-AC-001`, `PR-AC-028`–`030`; §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR1.2 | FR | Derived | Approved | 승인된 `F-HH-001`–`003`, `F-HH-005`, `PR-AC-027`–`029`, `PR-AC-058`; 최초 사용자와 구성원 접근에 필요한 bootstrap 흐름 | `PR-AC-027`–`029`, `PR-AC-058`; §4 tenant/권한 API | User Stories; `DS-003`, `DS-009` |
| FR1.3 | FR | Derived | Approved | 승인된 `PR-AC-002`–`003`, 제품 권한 매트릭스 §4, `D-068`; 같은 가구의 공유 데이터 접근 규칙 | `PR-AC-002`–`003`; §4 tenant/권한 API | User Stories; `DS-003`, `DS-004`, `DS-009` |
| FR1.4 | FR | Derived | Approved | 승인된 `F-ACC-002`, `NFR-SEC-002`, 보안 §2.2; 세션이 끝난 설치의 데이터 접근 차단을 보장하는 데 필요 | 로그아웃·만료·취소 뒤 인증 요청 거부; `DS-003`, §4 인증/API | User Stories; `DS-003`, `DS-009` |
| FR2 | FR | Derived | Approved | 승인된 `F-REM` 및 `F-HIS` 정책을 Reminder 생명주기로 묶음 | FR2.1–FR2.3의 PR-AC; §4 Reminder API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.1 | FR | Derived | Approved | 승인된 `F-REM-001`–`003`, `PR-AC-013`, `PR-AC-055`; 등록 가능한 Reminder에 필요한 필드와 담당자 | `PR-AC-013`, `PR-AC-055`; §4 core API/UI | User Stories; `DS-004`, `DS-009` |
| FR2.2 | FR | Derived | Approved | 승인된 `F-REM-002`–`004`, `PR-AC-002`, `PR-AC-034`–`035`, `PR-AC-065`; 명시된 보관·삭제 생명주기 | `PR-AC-002`, `PR-AC-034`–`035`, `PR-AC-065`; §4 core API/UI | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR2.3 | FR | Derived | Approved | 승인된 `F-REM-005`, `F-HIS-001`, `F-HIS-004`, `PR-AC-003`, `PR-AC-014`–`015`; 검증 기능이 꺼진 기본 완료 흐름 보존 | `PR-AC-003`, `PR-AC-014`–`015`; §4 domain/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR3 | FR | Derived | Approved | 승인된 `F-REC` 및 recurrence 정책을 규칙·회차 흐름으로 묶음 | FR3.1–FR3.3의 PR-AC; §4 recurrence/fake-clock | User Stories; `DS-006`, `DS-010` |
| FR3.1 | FR | Derived | Approved | 승인된 `F-REC-001`–`006`, `F-REC-008` 및 명시된 recurrence 수용 기준 | `PR-AC-011`, `032`, `046`–`050`, `060`, `067`; §4 recurrence | User Stories; `DS-006`, `DS-010` |
| FR3.2 | FR | Derived | Approved | 승인된 `F-REC-005`–`006`, `D-063`, `NFR-REL-004`; 편집 범위와 중복 회차 방지에 필요 | `D-063`, `NFR-REL-004`; §4 recurrence/idempotency | User Stories; `DS-009`, `DS-010` |
| FR3.3 | FR | Derived | Approved | 승인된 `F-REC-008`, `F-REM-007`–`008`, `PR-AC-033`–`037`, `060`; 전체 상태 경로 보존 | `PR-AC-033`–`037`, `060`; §4 recurrence/state | User Stories; `DS-006`, `DS-010` |
| FR4 | FR | Derived | Approved | 승인된 Trigger·notification 정책을 Android 사용자 흐름으로 묶음 | FR4.1–FR4.3의 PR-AC; §4 Android adapter/device | User Stories; `DS-002`, `DS-006`, `DS-011` |
| FR4.1 | FR | Derived | Approved | 승인된 `F-TRG-001`, `F-NOT-002`–`003`, 기존 시간 알림 기준 | `PR-AC-004`–`005`, `008`; §4 Android adapter/device | User Stories; `DS-006`, `DS-010`, `DS-011` |
| FR4.2 | FR | Derived | Approved | 승인된 `F-TRG-002`–`004`, `F-NOT-005`, 권한·geofence 용량 기준 | `PR-AC-006`, `009`, `016`, `066`, `068`; §4 Android adapter/device | User Stories; `DS-006`, `DS-010`, `DS-011` |
| FR4.3 | FR | Derived | Approved | 승인된 `F-NOT-006`–`007`, `F-NOT-009`, `F-SET-004`; 사용자 알림 정책의 설정·보안 완결에 필요 | `PR-AC-009`, `057`, `059`; §4 Android/UI | User Stories; `DS-006`, `DS-007`, `DS-011` |
| FR5 | FR | Derived | Approved | 승인된 목록·이력·보관함 기능을 사용자 조회 흐름으로 묶음 | FR5.1–FR5.2의 PR-AC; §4 history API/UI | User Stories; `DS-002`, `DS-005`, `DS-009` |
| FR5.1 | FR | Derived | Approved | 승인된 `F-LIST-001`–`003`, `F-LIST-005`, 목록 필터·정렬 수용 기준 | `PR-AC-056`, `061`, `063`; §4 UI flow | User Stories; `DS-002`, `DS-005` |
| FR5.2 | FR | Derived | Approved | 승인된 `F-LIST-004`, `F-LIST-008`, `F-HIS-001`–`004`; 완료·놓침·건너뜀·보관 기록 조회 | `PR-AC-011`, `034`, `064`; §4 history API/UI | User Stories; `DS-005`, `DS-009` |
| FR6 | FR | Derived | Approved | 승인된 서버 기준·클라이언트 동기화 아키텍처; 각 플랫폼에서 같은 업무 상태를 쓰고 읽는 데 필요 | FR6.1–FR6.3의 PR-AC; §4 sync/API | User Stories; `DS-002`, `DS-009`, `DS-011` |
| FR6.1 | FR | Derived | Approved | 승인된 `F-CLI-001`–`004`, `F-NOT-004`, `D-011`; 집 안팎의 온라인 서버 접근 및 오프라인 범위 | `PR-AC-007`, `010`; §4 API/UI | User Stories; `DS-002`, `DS-009` |
| FR6.2 | FR | Derived | Approved | 승인된 `F-NOT-004`, `PR-AC-008`, `010`, `NFR-REL-005`–`006`; 서버 상태와 설치 상태를 수렴시키는 데 필요 | `PR-AC-008`, `010`, `NFR-REL-005`–`006`; §4 sync/idempotency | User Stories; `DS-009`, `DS-011` |
| FR6.3 | FR | Derived | Approved | 승인된 `F-CLI-003`, `PR-AC-012`; 공유 UI를 Android 전용 API로부터 분리 | `PR-AC-012`; §4 platform adapter | User Stories; `DS-002`, `DS-011` |
| FR7 | FR | Derived | Approved | 승인된 설정·권한·locale 정책을 사용자 및 가구 설정 흐름으로 묶음 | FR7.1–FR7.3의 PR-AC; §4 settings/UI | User Stories; `DS-003`, `DS-007`, `DS-014` |
| FR7.1 | FR | Derived | Approved | 승인된 `F-SET-001`–`007`과 역할별 설정 범위; 설정 일관성과 선택 기능 관리에 필요 | `PR-AC-022`–`024`, `066`–`067`; §4 settings/API | User Stories; `DS-007` |
| FR7.2 | FR | User | Approved | 사용자 승인한 다국어 요구, `AFR-001` 승격, `D-065`–`066`, `D-093`, `Q-065`; 최초 locale 우선순위가 사용자에게서 확정됨 | `PR-AC-051`–`052`, `D-093`, `Q-065`; §4 locale/UI/API | User Stories; `DS-007`, `DS-014` |
| FR7.3 | FR | Derived | Approved | 승인된 `F-NOT-007`, `F-SET-004`; 설치 기능 상태를 드러내고 권한 변경 경로를 제공하는 데 필요 | `PR-AC-009`, `057`; §4 Android/UI | User Stories; `DS-007`, `DS-011` |
| FR8 | FR | User | Approved | 사용자가 범위 추가로 명시 승인한 `Q-063`, `D-091`, `F-REM-009` | `PR-AC-069`; §4 domain/API/flow | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.1 | FR | User | Approved | 승인된 `Q-063`·`D-091`; 담당자의 완료 요청을 검증 대기로 전환 | `PR-AC-069`; §4 domain/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.2 | FR | User | Approved | 승인된 `Q-063`·`D-091`; 승인·거절·응답 전 상태를 분리해 회차 완료를 판정 | `PR-AC-069`; §4 state/API | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR8.3 | FR | User | Approved | 승인된 범위는 포함되었으나 세부 정책은 의도적으로 미결정인 `Q-063`; 임의 정책 확정을 방지 | `Q-063`; 세부 검증은 `DS-004`·`DS-005`·`DS-009`에서 정함 | User Stories; `DS-004`, `DS-005`, `DS-009` |
| FR9 | FR | User | Approved | 사용자가 범위 추가로 명시 승인한 `Q-064`, `D-092`, `F-OPS-007`–`008` | `PR-AC-070`; §4 operations | User Stories; `DS-008`, `DS-014` |
| FR9.1 | FR | User | Approved | 승인된 `Q-064`·`D-092`; 주기 보고 및 장애 발생 시 제공 의무 | `PR-AC-070`; §4 operations | User Stories; `DS-008`, `DS-014` |
| FR9.2 | FR | User | Approved | 승인된 `Q-064`; 운영자와 측정·전달 세부는 추가 정책 결정 전 미정으로 유지 | `Q-064`; 세부 검증은 `DS-008`·`DS-014` | User Stories; `DS-008`, `DS-014` |
| FR10 | FR | Derived | Approved | 승인된 `F-OPS`·배포·백업 기준을 Raspberry Pi 운영 가능 흐름으로 묶음 | FR10.1–FR10.3의 PR-AC 및 NFR 참조; `docs/08-test-strategy.md` §7 운영 검증 | User Stories; `DS-008`, `DS-009` |
| FR10.1 | FR | Derived | Approved | 승인된 `F-OPS-001`–`002`, `F-OPS-004`, `D-077`; 서비스 시작·재시작과 로그 진단에 필요 | `PR-AC-062`; §7 RPi operations | User Stories; `DS-008`, `DS-009` |
| FR10.2 | FR | Derived | Approved | 승인된 `F-OPS-002`–`004`, `PR-AC-062`; 공개 관리면 없이 운영 상태를 확인하는 데 필요 | `PR-AC-062`; §7 RPi operations | User Stories; `DS-008` |
| FR10.3 | FR | Derived | Approved | 승인된 `F-OPS-003`, `F-OPS-005`, `NFR-REL-003`, `NFR-SEC-006`; 데이터 손상·복구 불가 위험을 줄이는 데 필요 | `PR-AC-031`, `NFR-REL-003`, `NFR-SEC-006`; §7 backup/restore | User Stories; `DS-008`, `DS-009` |
| NFR1 | NFR | Derived | Approved | 승인된 `NFR-SEC-001`–`005`와 접근 수용 기준; household 격리와 안전한 인증을 품질 조건으로 묶음 | `PR-AC-001`–`003`, `028`–`031`; §4 API/security | User Stories; `DS-003`, `DS-009`, `DS-014` |
| NFR2 | NFR | Derived | Approved | 승인된 `NFR-SEC-006`, `PR-AC-031`, `043`, `059`; 데이터 최소화·보호 정책 | `PR-AC-031`, `043`, `059`; §4 security/privacy | User Stories; `DS-008`, `DS-009`, `DS-014` |
| NFR3 | NFR | Derived | Approved | 승인된 `NFR-REL-001`–`007`; 재시도와 복구에서 중복·부분 적용을 제한 | `NFR-REL-001`–`007`; §4 unit/API/operations | User Stories; `DS-006`, `DS-008`–`DS-011`, `DS-014` |
| NFR4 | NFR | Derived | Approved | 승인된 `NFR-TIME-001`–`004`와 시간·반복 기준 | `PR-AC-050`–`051`; §4 fake-clock/timezone unit | User Stories; `DS-010`, `DS-014` |
| NFR5 | NFR | Derived | Approved | 승인된 `NFR-PERF-001`–`003`; 소규모 사용의 응답 목표와 RPi 경계 | p95 500ms 목표; 합격 측정 범위는 `DS-014`; §4 RPi performance | User Stories; `DS-008`, `DS-014` |
| NFR6 | NFR | User | Approved | 사용자가 요청한 고정 기기 크기 없는 반응형 웹; 승인된 `NFR-UX-001`–`004`, `D-078` | `PR-AC-007`, `043`, `063`; 가로 overflow·재배치·키보드·터치 합격 기준은 `DS-014`; §4 viewport/accessibility | User Stories; `DS-002`, `DS-014` |
| NFR7 | NFR | User | Approved | 사용자의 한국어·영어 기본 지원 및 향후 언어 확장 요청, 승인 `AFR-001`, `D-065`–`066`, `D-093`, `Q-065` | `NFR-I18N-001`–`002`, `PR-AC-052`; locale/UI/API 검증은 §4 및 `DS-014` | User Stories; `DS-007`, `DS-014` |
| NFR8 | NFR | Derived | Approved | 승인된 `PR-AC-012`, `D-006`, `D-008`, `D-053`–`057`; 제품 동작을 플랫폼 경계와 RPi 호환성 안에 유지 | `PR-AC-012`; §4 platform adapter/ARM64 compatibility | User Stories; `DS-002`, `DS-014` |
| NFR9 | NFR | User | Approved | 사용자 승인 `D-071`·팀 실천(TDD, 80% line coverage); 문서 정합성은 별도 미해결 과제로 유지 | TDD, 위험 기반 테스트, CI 및 80% 전체 line coverage 목표; `docs/08-test-strategy.md`와 구현 전 정합화 | User Stories; `DS-014`, `docs/08-test-strategy.md` §4 |
| NFR10 | NFR | Derived | Approved | 승인된 `PR-AC-062`, `D-077`, `NFR-REL-007`; 운영 상태 확인과 노출 경계에 필요 | `PR-AC-062`, `NFR-REL-007`; §7 operations/security | User Stories; `DS-008`, `DS-014` |

## 추적성 상태 해석

위 등록부의 `Approved`는 정책 근거의 수용 상태다. 구현·사용자 스토리·상세 설계·테스트 연결 상태는 별도의 `traceability.json`과 `docs/09-feature-design-coverage-and-backlog.md`가 관리하며, 아직 존재하지 않는 후속 산출물을 완료로 표시하지 않는다.
