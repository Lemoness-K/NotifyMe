---
layout: review
title: "Notify Me — 화면 상호작용 명세"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/refined-mockups/interaction-spec.md"
permalink: "/reviews/261115-notify-me-implementation/refined-mockups/20261117-223829714164/02-interaction-spec/"
---

# Notify Me — 화면 상호작용 명세

## 범위와 기준 입력

- `wireframes`: [저충실도 화면 구성](../../ideation/rough-mockups/wireframes.md)
- `user-flow`: [핵심 사용자 흐름](../../ideation/rough-mockups/user-flow.md)
- `stories`: [승인된 사용자 스토리](../user-stories/stories.md)
- `requirements`: [요구사항](../requirements-analysis/requirements.md)
- `team-practices`: [팀 실천](../practices-discovery/team-practices.md)
- 화면 배치는 승인된 업무 동작을 표현한다. 여기서 정하지 않은 권한, 상태 전이, 보존 기간 또는 운영 정책을 UI가 새로 확정하지 않는다.
- 시스템 문구는 `ko-KR`·`en-US` 리소스로 표시한다. 사용자가 작성한 Reminder 제목과 설명은 번역하지 않는다.

## 탐색 구조와 화면 계층

- 인증과 초대 수락은 인증되지 않은 진입 흐름이다. 초대 링크의 계정·가구 맥락을 확인한 뒤 Google 로그인과 이메일 일치 검증을 거쳐 앱으로 진입한다. 링크 조회만으로 초대를 소비하거나 Membership를 만들지 않는다 (`US1.1`, `US1.4`).
- 주 화면은 `할 일`, `이력`, `보관함`이다. 할 일은 기본 진입 화면이며, 좁은 배치에서는 하단 내비게이션을, 항목이 들어맞는 넓은 배치에서는 상단 내비게이션을 사용한다 (`D-079`).
- 할 일 화면의 세 보기는 `내 할 일`, `내가 요청한 일`, `가구 전체 보기`다. 공간이 부족하면 현재 값이 표시되는 선택 메뉴로 대체한다 (`D-078`, `US5.1`–`US5.3`).
- 설정은 프로필 메뉴에서 열며, Household·User·Installation 범위는 설정 화면에서 구분한다. Reminder 설정은 해당 Reminder의 생성·수정 흐름 안에서 관리한다 (`US6.1`, `US6.4`).
- 화면 제목, 현재 범위 또는 선택값, 주 동작은 본문보다 먼저 읽히는 순서로 배치한다. 뒤로 이동은 현재 화면의 변경을 임의 저장하지 않고, 미저장 입력이 있을 때는 변경 폐기 여부를 확인한다.

## 컴포넌트 명세

각 컴포넌트의 입력 표는 구현 프레임워크 API가 아니라 제품 동작에 필요한 설계 입력이다. 반응형 행은 고정 기기별 breakpoint를 선언하지 않고 콘텐츠가 들어맞는 조건을 사용한다.

### AppShellNavigation

| Field | Value |
|---|---|
| Component | AppShellNavigation |
| Description | 인증된 사용자가 주 화면과 현재 프로필 설정으로 이동한다. |
| Category | navigation / layout |

#### States

| State | Description | Trigger |
|---|---|---|
| loading | 인증 및 현재 household 확인 중이다. | 인증 세션 확인 |
| default | 세 목적지와 현재 선택을 표시한다. | 인증 성공 |
| session-error | 보호 데이터에 접근시키지 않고 로그인 복구를 안내한다. | 세션 만료·취소 |
| focus | 현재 키보드 초점을 명확히 표시한다. | Tab 또는 포인터 조작 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| currentDestination | destination | yes | Tasks | 현재 목적지 |
| locale | locale | yes | resolved locale | 시스템 문구와 날짜 표시에 사용 |
| availableWidth | layout input | yes | viewport content width | 콘텐츠 fit 상태 결정에 사용; 최소 지원폭이 아님 |
| sessionState | state | yes | loading | 인증·세션 상태 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 목적지와 프로필이 헤더에 들어맞음 | 상단 가로 내비게이션을 사용한다. |
| 항목이 겹치거나 잘림 | compact 헤더와 하단 목적지 내비게이션으로 재배치한다. |
| 텍스트 확대 또는 긴 locale label | 레이블을 줄바꿈하거나 배치를 바꾸고 목적지를 숨기지 않는다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 이름 있는 `nav` landmark, 현재 목적지 링크에 `aria-current="page"` |
| Keyboard interaction | Tab으로 목적지 이동, Enter로 활성화 |
| Label / aria-label | 보이는 로컬라이즈된 목적지 이름을 사용한다. |
| Contrast ratio | 텍스트 4.5:1, 의미 있는 컨트롤·상태 3:1 대비를 확인한다. |
| Screen reader | landmark 이름, 링크 이름, 현재 페이지 상태를 읽는다. |
| Focus management | 화면 이동 후 새 페이지 제목 또는 주요 콘텐츠로 초점을 둔다. |

#### Usage Example

```text
AppShellNavigation(currentDestination, locale, sessionState)
```

### TaskViewList

| Field | Value |
|---|---|
| Component | TaskViewList |
| Description | 보기별 활성 Occurrence와 빠른 상태 동작을 표시한다. |
| Category | input / display |

#### States

| State | Description | Trigger |
|---|---|---|
| loading | 콘텐츠 형태의 placeholder를 표시한다. | 목록 요청 |
| default | 선택한 보기의 활성 목록을 표시한다. | 목록 응답 |
| empty | 현재 보기 이름과 다음 행동을 표시한다. | 결과 없음 |
| partial | 확인 가능한 항목과 동기화 상태를 함께 표시한다. | 일부 요청 실패 |
| error | 재시도를 제공하고 현재 보기 선택을 유지한다. | 목록 요청 실패 |
| action-pending | 완료 동작의 중복 제출을 막는다. | 상태 변경 요청 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| selectedView | enum | yes | assigned-to-me | 내 할 일, 내가 요청한 일, 가구 전체 보기 |
| occurrences | list | yes | empty | 현재 보기에서 권한 있는 활성 회차 |
| syncState | state | yes | loading | 로딩·정상·일부·오류 상태 |
| locale | locale | yes | resolved locale | 시스템 날짜·시간·상태 문구 표시 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 보기 레이블과 주 동작이 들어맞음 | 세 보기를 한 행에서 선택할 수 있다. |
| 보기 레이블이 들어맞지 않음 | 현재 선택이 보이는 단일 선택 메뉴로 바꾼다. |
| 목록 메타데이터가 한 행에 들어맞지 않음 | 상태, 제목, 담당자·요청자, 동작 순으로 쌓는다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 보기 선택은 `radiogroup` 또는 native `select`; 결과는 heading과 `list`/`listitem` 구조로 제공한다. |
| Keyboard interaction | 선택 그룹은 표준 단일 선택 키 조작, 항목 동작은 Tab 후 Enter/Space로 실행한다. |
| Label / aria-label | 각 보기와 각 Reminder 동작에 목적을 설명하는 이름을 둔다. |
| Contrast ratio | 상태·컨트롤 식별에 필요한 텍스트 4.5:1, 경계·상태 표시 3:1을 확인한다. |
| Screen reader | 분류 제목, Reminder 제목, 상태, 행위자와 동작을 논리적 순서로 읽는다. |
| Focus management | 보기 변경 후 초점을 선택 컨트롤에 두고 새 결과 상태를 알린다. |

#### Usage Example

```text
TaskViewList(selectedView, occurrences, syncState, onOccurrenceAction)
```

### ReminderEditor

| Field | Value |
|---|---|
| Component | ReminderEditor |
| Description | Reminder의 사람·내용·Trigger·반복·선택 검증을 생성하거나 수정한다. |
| Category | input / layout |

#### States

| State | Description | Trigger |
|---|---|---|
| pristine | 입력 기본값 또는 현재 값을 보여준다. | 화면 진입 |
| invalid | 오류가 있는 필드와 수정 안내를 표시한다. | 클라이언트 검증 실패 |
| saving | 중복 저장을 막고 진행 중임을 알린다. | 저장 요청 |
| save-error | 서버 결과를 성공으로 표시하지 않고 입력을 유지한다. | 요청 실패 |
| permission-limited | 저장은 허용하되 해당 Installation의 제한을 설명한다. | 위치 권한 거부 |
| capacity-error | 전체 저장을 막고 영향을 받는 Installation을 설명한다. | geofence 용량 부족 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| reminder | object or empty | no | new Reminder defaults | 편집할 값 또는 생성 모드 |
| householdSettings | object | yes | saved values | 반경·지속 시간·주간 기준 |
| members | list | yes | current household members | 요청자·담당자·verifier 선택 후보 |
| installationState | object | yes | current installation | 위치 권한·용량과 안내 상태 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 관련 짧은 필드가 나란히 들어맞음 | 요청자·담당자 또는 날짜·시간을 묶어 배치할 수 있다. |
| 좁은 폭, 확대, 키보드 표시 | 단일 열로 흐르고 저장·취소가 가려지지 않게 한다. |
| 한국어·영어 레이블이 길어짐 | 필드가 늘어나고 레이블·오류가 잘리지 않게 한다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 의미 구조가 있는 `form`, 관련 선택은 `fieldset`/`legend` |
| Keyboard interaction | Tab 순서로 모든 필드를 조작하고 Enter로 제출할 수 있다. |
| Label / aria-label | visible label과 설명을 입력에 연결하고 필수·단위를 표시한다. |
| Contrast ratio | 텍스트 4.5:1, 입력 경계·초점·오류 표시 3:1을 확인한다. |
| Screen reader | 필수 여부, 입력 형식, 필드별 오류, 저장 결과를 알린다. |
| Focus management | 검증 실패 시 오류 요약 또는 첫 오류 필드로 이동하고, 저장 결과에서 초점을 임의로 빼앗지 않는다. |

#### Usage Example

```text
ReminderEditor(reminder, householdSettings, members, installationState)
```

### TriggerRecurrenceEditor

| Field | Value |
|---|---|
| Component | TriggerRecurrenceEditor |
| Description | TIME 또는 LOCATION 조건과 RecurrenceRule을 편집한다. |
| Category | input |

#### States

| State | Description | Trigger |
|---|---|---|
| time-selected | 시간·날짜 필드만 활성화한다. | TIME 선택 |
| location-selected | 장소·반경·이벤트 조건을 표시한다. | LOCATION 선택 |
| recurrence-none | 반복하지 않는 상태를 표시한다. | 안 함 선택 |
| recurrence-editing | 일·주·월 규칙과 선택 종료일을 표시한다. | 반복 편집 |
| invalid | 범위·형식 오류를 해당 필드에 표시한다. | 검증 실패 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| triggerType | enum | yes | existing or approved default | `TIME` 또는 `LOCATION` |
| householdRadius | object | required for LOCATION | min/default/max settings | 허용 반경 범위 |
| maxLocationDuration | integer minutes | required for duration trigger | 60 minutes | household 상한 |
| timeZone | IANA time zone | yes | approved schedule zone | 시간 입력과 반복 설명 |
| weekConvention | enum | yes | `MONDAY_START` | 새 주간 반복 규칙 기준 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 날짜·시간 입력이 들어맞음 | 날짜와 시간을 가까운 관계의 짧은 필드로 배치할 수 있다. |
| 입력 너비가 부족함 | 시간·장소·반복 영역을 읽기 순서대로 쌓는다. |
| 지도·장소 검색 제공자가 미확정 | 검색 UI를 가정하지 않고 선택한 장소·이벤트 값과 도움말을 표시한다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | Trigger 유형은 `fieldset` 안의 단일 선택, 입력은 native control을 우선한다. |
| Keyboard interaction | 라디오·select·날짜/시간 입력은 표준 키보드 조작을 따른다. |
| Label / aria-label | 거리(m), 지속 시간(분), 날짜와 시간대 기준을 명시한다. |
| Contrast ratio | 텍스트 4.5:1, 선택·경계·오류 상태 3:1을 확인한다. |
| Screen reader | 현재 Trigger 유형과 그에 따라 활성화된 입력 그룹을 알린다. |
| Focus management | Trigger 변경 후 활성 그룹으로 초점을 옮기지 않고 현재 조작 위치를 유지한다. |

#### Usage Example

```text
TriggerRecurrenceEditor(triggerType, householdSettings, timeZone, weekConvention)
```

### OccurrenceActionsVerificationPanel

| Field | Value |
|---|---|
| Component | OccurrenceActionsVerificationPanel |
| Description | 현재 회차의 완료·검증 상태와 허용된 다음 동작을 표시한다. |
| Category | input / display / feedback |

#### States

| State | Description | Trigger |
|---|---|---|
| actionable | 승인된 다음 동작을 제공한다. | 활성 Occurrence |
| submitting | 중복 변경 요청을 막는다. | 완료·검증 제출 |
| awaiting-verification | 지정된 검증 대기 결과를 표시한다. | 검증 요청 저장 |
| completed | 완료와 행위자·시각을 표시한다. | 완료 또는 승인 저장 |
| rejected | 승인된 거절 결과와 미완료 상태를 표시한다. | verifier 거절 저장 |
| sync-error | 저장되지 않은 변경을 완료로 표시하지 않는다. | 상태 변경 실패 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| occurrenceState | enum | yes | server state | 회차의 현재 상태 |
| verificationEnabled | boolean | yes | saved value | Reminder 검증 사용 여부 |
| actorPermissions | object | yes | server-derived | 현재 사용자에게 허용된 동작 |
| mutationState | state | yes | idle | 제출·성공·실패 상태 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 주 동작과 제목이 들어맞음 | 상태 가까이에 주 동작을 표시한다. |
| 좁은 폭 | 보조 동작은 더보기로 옮길 수 있지만 주 상태 변경은 계속 노출한다. |
| 검증 정보가 길어짐 | 제출자·시간·결과를 여러 줄로 표시하고 잘라내지 않는다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 상태 영역은 의미 구조, 갱신 메시지는 `status`/live region을 사용한다. |
| Keyboard interaction | 허용된 동작을 Tab으로 이동하고 Enter/Space로 실행한다. |
| Label / aria-label | 승인·거절·완료 요청의 대상 Occurrence를 이해할 수 있게 한다. |
| Contrast ratio | 텍스트 4.5:1, 컨트롤·상태 표시 3:1을 확인한다. |
| Screen reader | 상태, 제출자, 시간과 변경 결과를 갱신 시 읽는다. |
| Focus management | 요청 이후 초점을 동작에 유지하고 변경 결과는 상태 메시지로 전달한다. |

#### Usage Example

```text
OccurrenceActionsVerificationPanel(occurrenceState, actorPermissions, mutationState)
```

### HistoryArchiveViews

| Field | Value |
|---|---|
| Component | HistoryArchiveViews |
| Description | 상태 이력과 보관 Reminder를 각각의 기본 범위·순서로 탐색한다. |
| Category | display / input |

#### States

| State | Description | Trigger |
|---|---|---|
| loading | 현재 범위의 콘텐츠 placeholder를 표시한다. | 조회 시작 |
| populated | 이력 또는 보관 목록을 표시한다. | 결과 응답 |
| empty | 현재 범위에 대한 빈 설명과 다음 동작을 표시한다. | 결과 없음 |
| error | 범위·필터를 유지하고 재시도한다. | 요청 실패 |
| destructive-confirmation | 삭제 대상과 복구 불가 사실을 확인한다. | 영구 삭제 선택 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| viewType | enum | yes | history or archive route | 화면 종류 |
| historyRange | enum | history only | assigned-to-current-user | 내 담당 또는 household |
| items | list | yes | empty | 이력 또는 보관 목록 |
| mutationState | state | yes | idle | 복원·삭제 요청 결과 |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 각 항목 메타데이터가 들어맞음 | 제목·상태·시간·행위자를 읽기 순서로 한 행에 배치할 수 있다. |
| 폭·확대 때문에 항목이 겹침 | 상태, 제목, 시간·행위자, 동작 순으로 세로로 쌓는다. |
| 삭제 확인 dialog가 화면을 초과 | dialog 내용을 세로로 스크롤하되 확인·취소 동작을 접근 가능하게 유지한다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 이력과 보관함은 heading 아래 `list`/`listitem`; 삭제 확인은 `dialog` |
| Keyboard interaction | 행 링크와 복원·삭제·필터 동작을 키보드로 실행할 수 있다. |
| Label / aria-label | 상태·시각·행위자를 연결하고 삭제 확인에 Reminder 제목을 포함한다. |
| Contrast ratio | 텍스트 4.5:1, 의미 있는 아이콘·경계·선택 상태 3:1을 확인한다. |
| Screen reader | 완료·놓침·건너뜀을 텍스트와 발생 시각으로 구분한다. |
| Focus management | 삭제 dialog 열기 시 제목으로 이동하고 종료 시 호출 동작으로 복귀한다. |

#### Usage Example

```text
HistoryArchiveViews(viewType, historyRange, items, mutationState)
```

### SettingsGroupLocaleSelector

| Field | Value |
|---|---|
| Component | SettingsGroupLocaleSelector |
| Description | 설정값의 소유 범위와 현재 Installation 상태, 계정 locale을 보여준다. |
| Category | navigation / input / display |

#### States

| State | Description | Trigger |
|---|---|---|
| loading | 각 scope 값 조회 중이다. | 설정 요청 |
| editable | 사용자 권한 범위에서 편집할 수 있다. | Admin/User 권한 확인 |
| read-only | 편집 권한이 없어 현재값만 표시한다. | 권한 없음 |
| saving | 선택한 locale 또는 설정을 저장 중이다. | 저장 요청 |
| save-error | 선택과 기존 저장값을 혼동하지 않게 오류를 알린다. | 저장 실패 |
| installation-limited | 현재 기기의 권한·채널 제한을 표시한다. | OS 상태 조회 |

#### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| householdSettings | object | yes | saved household values | Admin 소유값과 편집 권한 |
| userLocale | locale or empty | yes | device locale fallback | 계정에 저장할 언어 |
| installationState | object | yes | current installation | OS 권한·알림 채널 상태 |
| reminderSettings | object | no | managed in ReminderEditor | 설정 범위 설명만 제공하고 여기서 복제하지 않는다. |

#### Responsive Behaviour

| Layout condition | Behaviour |
|---|---|
| 범주·설명·값이 함께 들어맞음 | 범주와 설정 내용을 나란히 배치할 수 있다. |
| 폭이 부족함 | 현재 범주가 드러나는 선택 메뉴 다음에 단일 열 내용을 표시한다. |
| 언어 선택값 길이 증가 | control을 늘리거나 줄바꿈하고 선택값을 숨기지 않는다. |

#### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | 설정 범주는 이름 있는 navigation 또는 native single-select; 값 그룹은 heading/fieldset |
| Keyboard interaction | 범주·언어·설정 컨트롤을 키보드로 이동·변경할 수 있다. |
| Label / aria-label | 각 값의 Household/User/Installation 소유 범위와 권한을 설명한다. |
| Contrast ratio | 텍스트 4.5:1, 조작 요소·선택·초점 3:1을 확인한다. |
| Screen reader | 현재 locale, 저장 scope, Installation 제한과 저장 결과를 알린다. |
| Focus management | 저장 후 컨트롤에 초점을 유지하며 OS 설정 이동 전 목적을 설명한다. |

#### Usage Example

```text
SettingsGroupLocaleSelector(householdSettings, userLocale, installationState)
```

## 공통 피드백과 실패 복구

| 상황 | 화면 피드백 | 입력·범위 처리 |
|---|---|---|
| 최초 데이터 조회 | 콘텐츠 형태의 로딩 표시 | 완료 전 빈 상태로 오인시키지 않는다. |
| 결과 없음 | 해당 보기·범위 이름과 다음 행동 | 현재 선택한 범위를 유지한다. |
| 네트워크·서버 오류 | 사람이 이해할 수 있는 원인과 재시도 | 저장 실패를 성공처럼 표시하지 않고 편집 입력을 유지한다. |
| 부분 동기화 | 현재 확인 가능한 정보와 동기화 상태 | 사용할 수 있는 항목은 유지하고 새로 고침을 제공한다. |
| 권한 제한 | 영향을 받는 설치·기능과 OS 설정 경로 | 핵심 Reminder 조회·관리는 허용한다. |
| 중복 제출 방지 | 진행 중 표시와 이후의 저장 결과 | 저장 중 주 동작을 비활성화하고 요청이 끝나면 결과를 알린다. |

## 반응형·언어 동작

- 제품 요구사항은 지원 디스플레이의 고정 최소 너비를 선언하지 않는다. 탐색·필드·카드가 겹치기 전에 단일 열, 줄바꿈, 현재값 선택 메뉴로 재배치한다.
- 뷰포트 값은 웹의 CSS px 기준이다. CSS px는 물리 디스플레이 pixel이나 PPI와 같은 뜻이 아니다. WCAG 2.1 AA의 Reflow 검증은 세로 스크롤 콘텐츠를 320 CSS px 상당 너비에서 정보·기능 손실과 2차원 스크롤 없이 확인한다. 이 값은 접근성 적합성 검사 조건이며 제품의 최소 지원 화면 경계로 쓰지 않는다 ([WCAG 2.1 SC 1.4.10](https://www.w3.org/TR/WCAG21/#reflow), [W3C Reflow 이해](https://www.w3.org/WAI/WCAG21/Understanding/reflow)).
- 320·360 CSS px, 중간 폭, 넓은 폭은 반응형 검토를 위한 표본으로 사용할 수 있다. 레이아웃은 텍스트 확대, 긴 한국어·영어 레이블, 소프트 키보드와 가용 폭 변화에서도 핵심 기능을 보존한다.
- 화면 문구·날짜·시간·숫자·복수형은 locale 규칙을 적용하고, 사용자 작성 텍스트는 원문을 보존한다. API 상태 코드는 locale-neutral로 유지하고 UI에서 번역한다.

## 열린 정책

- `Q-063`: 완료 검증의 권한 경계, 복수 참여, 취소, 만료, 알림 및 재알림은 열린 상태다. UI는 승인된 on/off와 지정 verifier, 대기·승인·거절 결과만 표현한다.
- `Q-064`: 주간 보고와 장애 알림의 운영자 식별, 내용, 시간대, 감지 기준, 중복 억제, 수신자, 채널, 재시도는 열린 상태다. 이 화면 설계는 별도 운영자 계정이나 콘솔을 추가하지 않는다.
- 제품이 확정하지 않은 브랜드 색상, 서체, 아이콘 팩과 시각 스타일은 디자인 토큰 매핑에 의미 기반 이름으로만 둔다.

## 텍스트 대체 설명

로그인 후 사용자는 반응형 앱 셸에서 할 일·이력·보관함을 탐색한다. 할 일 보기, Reminder 편집, 회차 상태 동작, history/archive 수명주기, 설정 범위와 언어 선택은 현재 사용자·가구·Installation 상태를 보여주며, 입력 오류·권한 부족·동기화 실패에서도 입력과 상태 맥락을 유지한다.
