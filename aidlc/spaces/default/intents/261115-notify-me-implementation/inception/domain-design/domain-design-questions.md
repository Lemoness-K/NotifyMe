# Notify Me 도메인 설계 초안

## 설계 범위

승인된 요구사항과 사용자 스토리를 바탕으로 논리 컴포넌트, 엔티티 소유권, 컴포넌트 간 호출 방향을 제안한다. 기존 모듈형 모놀리스와 플랫폼 중립 인터페이스를 설계 기준으로 사용한다. 배포 단위는 Units Generation에서 정한다.

## 컴포넌트와 소유 데이터

| 컴포넌트 | 책임 | 소유 데이터 |
|---|---|---|
| `ClientExperience` | 공유 반응형 UI, 화면 이동, 상태 표시와 번역. 가구 업무와 기기 기능을 각 경계에 요청한다. | 화면 세션의 UI 상태 |
| `IdentityHouseholdAccess` | 외부 인증을 내부 사용자에 연결하고 가구 가입, 역할, 초대와 접근 권한을 관리한다. | User, AuthIdentity, Household, Membership, Invitation |
| `ReminderLifecycle` | 리마인더 생성·수정·보관·삭제, 담당자, 반복 일정, 회차와 완료 상태를 관리한다. | Reminder, Assignment, RecurrenceRule, Trigger, Occurrence, OccurrenceOverride, Completion |
| `SettingsManagement` | 설정 항목의 메타데이터를 한 카탈로그에 모으고 가구·사용자 설정 값을 관리한다. | HouseholdSettings, UserSettings. 기존 프로필 필드는 해당 프로필 소유자가 관리한다. |
| `AuditChangeHistory` | 사용자에게 보여주는 변경 이력과 기기 동기화용 변경 피드를 구분한다. | AuditEvent, 변경 피드와 발행 대기 기록 |
| `DeviceSynchronization` | 설치를 등록하고 서버의 대상 상태, 설치별 예약 계획과 동기화 진행을 관리한다. | DeviceInstallation, DeviceTrigger, LocationConditionEvent, SyncState |
| `PlatformCapabilities` | 설치의 로컬 알람, 알림, 지오펜스, 권한과 OS 설정을 플랫폼 중립 인터페이스로 제공한다. | OS 등록 상태와 설치 로컬 실행 상태 |
| `OperationalSupport` | 운영 상태 진단, 백업·복구, 업데이트와 선택적 보고·장애 알림을 맡는다. | 세부 운영 기록의 형태는 운영 설계에서 정한다. |

## 대표 흐름

- **Reminder 생성과 기기 반영** · 공유 UI가 생성 요청을 보낸다. 가구 접근과 설정 규칙을 확인하고, Reminder와 필요한 변경 기록을 함께 저장한다. 영향받은 설치는 변경 신호를 받거나 앱을 다시 열 때 최신 상태를 가져와 OS 예약을 맞춘다.
- **같은 계정의 설정 공유** · 사용자가 언어를 바꾸면 계정 설정이 갱신되고 같은 사용자의 다른 설치가 이를 가져온다. 기존 일정과 알림 시점은 일정 데이터에 저장된 기준으로 계산한다.
- **권한 및 상태 변경** · 구성원 제거와 반경 범위 변경처럼 여러 소유자에게 영향을 주는 작업은 애플리케이션에서 조정한다. 각 컴포넌트가 자기 데이터를 변경하고 필요한 서버 변경은 하나의 트랜잭션으로 처리한다.

## 설정 범위

| 범위 | 값이 속하는 곳 | 예시 |
|---|---|---|
| `HOUSEHOLD` | 가구 설정 또는 가구 프로필 | 새 일정 기본 시간대, 장소 반경 기본값과 범위 |
| `USER` | 사용자 설정 또는 사용자 프로필 | 계정 언어, 표시 시간대 |
| `INSTALLATION` | 해당 설치의 OS 또는 앱이 관측한 설치 상태 | 알림 권한, 지오펜스 등록 상태 |
| `REMINDER` | 해당 Reminder, Trigger 또는 RecurrenceRule | 실제 장소 반경, 저장된 반복 달력 기준 |

## 기준 문서

- 사용자 승인 입력은 Requirements Analysis 요구사항, User Stories, Refined Mockups와 Practices Discovery 팀 실천 기록을 사용한다.
- 기존 구조는 CodeKB의 아키텍처와 컴포넌트 목록, 프로젝트 마스터 설계와 도메인·알림·설정 문서를 참고한다.
- 열린 질문은 [결정 등록부](../../../../../../../docs/decision-register.md#질문-id-이력)를 기준으로 추적하고, 각 질문은 관련 상세 설계 단계에서 다룬다.

## Consolidated Summary Confirmation

- 위 8개 컴포넌트의 책임과 엔티티 소유권을 바탕으로 설계 문서와 스토리 추적표를 작성한다.
- 설정 메타데이터는 한 카탈로그에 모으고 값은 가구·사용자·설치·Reminder 각 범위의 소유 위치에 둔다.
- 기기 동기화와 OS 실행을 분리하고, 여러 컴포넌트가 함께 바뀌는 작업은 애플리케이션에서 조정한다.
- 열린 질문은 결정 등록부로 연결한다.

이 설계 초안이 맞나요?

- Looks correct
- Request changes

[Answer]: Looks correct

## Requested Changes Feedback

What should change?

[Answer]: 열린 질문을 모두 언급하는거도 아니고 지금 있는 일부만 언급하는게 이상해. 모두 하거나, 안하는쪽으로 고려해줘. 아니면 어떤 문서에 있는 열린 이슈들을 고려한다 정도로 써도될것같아.. 의견 부탁해
