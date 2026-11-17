---
layout: review
title: "Notify Me — 반응형 화면 목업"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/refined-mockups/mockups.md"
permalink: "/reviews/261115-notify-me-implementation/refined-mockups/20261117-223829714164/01-mockups/"
---

# Notify Me — 반응형 화면 목업

## 설계 기준

- 기준 입력: `wireframes` ([저충실도 화면 구성](../../ideation/rough-mockups/wireframes.md)), `user-flow` ([핵심 사용자 흐름](../../ideation/rough-mockups/user-flow.md)), `stories` ([사용자 스토리](../user-stories/stories.md)), `requirements` ([요구사항](../requirements-analysis/requirements.md)), `team-practices` ([팀 실천](../practices-discovery/team-practices.md)), `DS-005` 화면 초안 및 설정 설계.
- 화면 구조는 업무 동작과 분리한다. 향후 브랜드 가이드는 design token과 공통 view를 바꾸어 적용하고 권한·상태 전이·저장 동작은 그대로 둔다.
- 전체 웹 화면은 고정된 기기 종류·최소 너비를 요구하지 않는다. 이 문서의 `compact`와 `expanded`는 콘텐츠에 맞춘 배치 상태를 뜻하며 모바일·데스크톱 지원 경계를 뜻하지 않는다.
- 제품은 고정 최소 화면 너비를 두지 않는다. 웹의 CSS px는 물리 화면 pixel이나 PPI가 아니다. WCAG 2.1 AA Reflow의 320 CSS px 상당 너비는 적합성 검사 조건이며 제품의 최소 지원 화면 경계가 아니다. 기존 rough mockup의 “320 CSS px부터” 문구도 최소 너비로 해석하지 않는다. 360 CSS px는 추가 반응형 검토 표본이다 ([WCAG 2.1 SC 1.4.10](https://www.w3.org/TR/WCAG21/#reflow)).
- 넓은 배치의 내비게이션은 상단 가로 메뉴를 권고한다. 이는 세 주요 목적지를 빠르게 오갈 수 있는 화면 구성 제안이며 별도 제품 권한이나 동작을 정의하지 않는다.
- `ko-KR`과 `en-US`는 시스템 문구와 날짜·시간·숫자 표시에 적용한다. 사용자가 작성한 Reminder 제목·내용은 원문 그대로 보인다.

## 공통 화면 껍데기

### Compact 배치

```text
HEADER: Notify Me / Profile
TITLE: [Localized screen title]                 ACTION: [Primary action]
CONTENT: [Current screen content]
BOTTOM NAV: Tasks / History / Archive
```

- 본문은 한 열로 흐르고 카드·입력은 가용 폭에 맞춰 늘어난다. 하단 메뉴는 `할 일`, `이력`, `보관함`을 항상 직접 열며 선택 상태를 텍스트·아이콘·모양으로 함께 표시한다.
- `설정`은 프로필 메뉴에서 연다. Reminder별 설정은 해당 Reminder 추가·수정 흐름에 둔다.
- 소프트 키보드가 나타나면 입력과 저장/취소 동작이 가려지지 않도록 화면을 재배치한다.

### Expanded 배치

```text
HEADER: Notify Me / Tasks / History / Archive / Profile
TITLE: [Localized screen title]                         ACTION: [Primary action]
CONTENT: [Main content with a readable maximum width]
```

- 내비게이션이 헤더 안에 들어맞을 때 상단 가로 메뉴를 사용한다. 요소가 겹치거나 잘리기 전에 `Compact 배치`로 자연스럽게 전환한다.
- 본문은 넓은 화면에서 무한히 늘어나지 않도록 콘텐츠 폭을 제한한다. 목록은 읽기 쉬운 단일 흐름을 유지하며, Reminder 편집처럼 관련 필드를 나란히 놓을 때에만 두 열을 사용한다.
- 전환은 CSS viewport의 최소 지원값이 아니라 실제 콘텐츠가 들어맞는지를 기준으로 한다. 가로 스크롤은 주 콘텐츠 탐색 수단으로 사용하지 않는다.

## 화면 1 — 초대 확인과 로그인

```text
HEADER: Notify Me
TITLE: [Household invitation]
MESSAGE: [You are invited to join household name]
ACCOUNT: [Invitation email]
ACTION: [Continue with Google]
HELP: [Invitation expired or account does not match]
```

- 초대 링크의 대상 계정과 가구 가입 맥락을 표시하고 Google 로그인으로 이어진다. 초대 코드를 수동 입력하거나 최초 Admin을 웹에서 생성하는 동작은 없다.
- 확인 중에는 초대 설명을 유지하고 진행 상태를 알린다. 만료·취소·이메일 불일치는 이유와 다시 초대를 요청할 방법을 텍스트로 제공한다.
- 사용자가 브라우저 또는 Android 셸로 진입해도 가입 후 동일한 업무 화면으로 연결한다. Android 권한 요청은 가입 성공 후 상태별로 설명한다.

## 화면 2 — 할 일 목록

```text
TITLE: Tasks                                      ACTION: [Add Reminder]
VIEW: [My tasks] [Requested by me] [Household]
SECTION: Overdue
ITEM: [In progress] Reminder title                ACTION: [Complete]
META: Due time / Assignees / Requester
SECTION: Today
ITEM: [Awaiting verification] Reminder title      ACTION: [Details]
META: Due time / Assignees / Requester
SECTION: Upcoming
ITEM: [Recurring] Reminder title                   ACTION: [Complete]
META: Recurrence / Assignees
```

- 현재 사용자의 첫 보기인 `내 할 일`을 기본 선택한다. `내가 요청한 일`은 요청자 ID, `가구 전체 보기`는 현재 가구의 모든 활성 미완료 회차를 기준으로 한다.
- 폭이 충분하면 세 보기 버튼을 나란히 표시한다. 보기 이름과 주요 동작이 들어맞지 않으면 현재 값이 드러나는 선택 메뉴로 전환한다. 정확한 전환 지점은 내용 너비로 정하고 고정 지원 폭으로 사용하지 않는다.
- 섹션은 `기한 초과` → `오늘` → `예정` 순서다. 시간 항목은 예정 시각, 장소 항목은 장소 조건으로 설명한다. Reminder 제목·요청자·담당자는 길이에 맞춰 줄바꿈한다.
- 검증이 꺼진 회차는 `완료`, 켜진 회차는 `검증 요청`으로 다음 동작을 표시한다. 반복 PENDING 회차의 `이번 회차 건너뛰기`는 카드 보조 동작에 둔다.
- 빈 보기에는 보기 이름과 다음 행동을 제공한다. 로딩은 실제 콘텐츠 형태의 placeholder, 오류는 원인과 재시도, 부분 결과는 현재 확인 가능한 항목과 동기화 상태를 표시한다.

## 화면 3 — Reminder 추가·수정

```text
HEADER: [Back] / Add Reminder
FIELD: Title [Required]
FIELD: Description [Optional]
FIELDS: Requester / Assignees
FIELD: Trigger [Time] [Location]
FIELDS: Date and time / Time zone / Recurrence
FIELD: Completion verification [Off] [On]
FIELD: Verifier [Visible when enabled]
FOOTER: [Cancel] / [Save]
```

- 넓은 배치에서 요청자·담당자, 날짜·시간처럼 관련된 짧은 입력만 나란히 둔다. 좁거나 확대된 화면에서는 순서가 유지된 단일 열로 쌓는다.
- `시간`과 `장소`는 하나만 선택한다. 장소를 고르면 장소 정보, 반경, `진입/이탈/머무름/이탈 후 경과` 중 하나의 조건을 편집한다. 장소 선택의 구체 지도·검색 방식은 이 목업에서 확정하지 않는다.
- 반경 입력은 가구 최소·최대 범위 안에서 25m 단위로 조정하고 기본값 100m를 표시한다. `DWELL`·`AFTER_EXIT`은 허용된 빠른 선택과 정수 분 직접 입력을 제공한다.
- 반복은 일·주·월 규칙 및 선택 종료일을 설정한다. 주 시작 기준과 시간대의 설명은 가구 설정을 따른다.
- 선택적 완료 검증을 켜면 승인된 다른 가구 구성원 선택 흐름을 보여준다. Q-063에서 열린 검증 권한·복수 참여·취소·만료·재알림은 새 컨트롤이나 안내로 만들지 않는다.
- 위치 권한이 없는 설치에서는 저장을 계속 허용하고 해당 설치의 불가 상태 및 Android 설정 이동을 안내한다. 저장 중복 제출을 막고 성공·실패를 알려준다.
- 대상 설치의 geofence 용량이 부족하면 저장을 차단하고 입력을 보존한다. 영향받는 설치와 확보 방법을 인라인 안내로 보여주고, 기존 설치 감지를 멈추는 동작은 확인을 거친다.
- 필수 입력 오류는 입력 가까이에 설명한다. 서버·네트워크 오류나 용량 제한 뒤에도 제목·설명·설정 입력은 남긴다.

## 화면 4 — Reminder 상세와 완료 검증

```text
HEADER: [Back] / Reminder title
STATUS: [Current occurrence status]
CONTENT: [User-entered description]
META: Localized due time / Requester / Assignees
META: Trigger / Recurrence
ACTIONS: [Edit] [Archive] [More]
CONDITIONAL ACTION: [Request verification]
VERIFICATION PANEL: [Pending status / Submitter / Submitted time]
VERIFICATION ACTIONS: [Reject] [Approve]
```

- 상세 화면은 현재 Occurrence 상태, 일정·장소 조건, 요청자·담당자, 반복 및 이력 진입점을 보여준다.
- 검증이 꺼져 있으면 회차를 바로 완료한다. 켜져 있으면 담당자의 완료 동작을 검증 요청으로 표시하고 승인 전까지 `검증 대기`로 유지한다.
- 승인된 검증 흐름에 맞는 가구 구성원이 응답하면 `승인` 또는 `거절` 결과를 표시한다. Q-063에서 해결되지 않은 권한·만료·취소·알림 정책은 이 화면에 고정하지 않는다.
- 상태 변경·동기화 결과는 텍스트로 알린다. 변경 실패 시 서버 결과를 완료로 표시하지 않고 최신 상태를 다시 불러오는 방법을 제공한다.

## 화면 5 — 이력

```text
TITLE: History
FILTER: [Assigned to me] [Household history]
ITEM: [Completed] Reminder title
META: Localized status time / Actor
ITEM: [Missed] Reminder title
META: Localized status time / Assignee
ITEM: [Skipped] Reminder title
META: Localized status time / Actor
```

- 기본 범위는 현재 사용자가 담당자로 지정된 Reminder의 이력이다. 같은 화면에서 가구 전체 이력으로 바꿀 수 있으며 화면을 나갔다가 재진입하면 기본 범위로 돌아온다.
- 완료·놓침·건너뜀은 한 목록에서 상태 텍스트와 시각으로 구분하고 발생 시각 최신순으로 정렬한다. 항목을 열면 Reminder 상태 흐름과 주요 변경 이력으로 연결한다.
- 빈 상태, 요청 실패, 부분 로딩은 기존 범위를 유지하고 재시도 동작을 제공한다.

## 화면 6 — 보관함과 영구 삭제 확인

```text
TITLE: Archive
ITEM: [Recurring paused] Reminder title
META: Archived time                         ACTIONS: [Restore] [More]
ITEM: Reminder title
META: Archived time                         ACTIONS: [Restore] [More]
DIALOG: Permanently delete [Reminder title]?
MESSAGE: This cannot be undone in the app.
ACTIONS: [Cancel] [Delete permanently]
```

- 보관함은 최근 보관 순으로 보여준다. 복원 실패는 카드를 유지하고 원인·재시도를 제공한다.
- 영구 삭제는 제목과 복구 불가 안내를 확인한 뒤 한 번 더 명시적으로 선택해야 한다. 취소하면 데이터를 변경하지 않는다.
- 대화상자가 열리면 제목으로 초점을 이동하고 닫히면 실행 버튼으로 돌린다. 좁은 화면에서는 화면 폭을 넘지 않는 단일 열 확인 화면으로 표시해도 된다.

## 화면 7 — 설정과 설치 상태

```text
TITLE: Settings
CATEGORIES: [Household] [Personal] [This device]
HOUSEHOLD: Location radius [Min] [Default] [Max]
HOUSEHOLD: Maximum location duration / Week start
PERSONAL: App language / Display time zone
THIS DEVICE: Notification permission / OS settings
THIS DEVICE: Notification channel / OS settings
THIS DEVICE: Location permission / OS settings
THIS DEVICE: Synchronization state
```

- 넓은 화면에서 설정 범주와 내용을 나란히 놓을 수 있다. 공간이 부족하면 범주 선택을 상단 선택 메뉴로 바꾸고 내용을 단일 열로 표시한다.
- `HOUSEHOLD` 값은 Admin만 편집한다. `USER` locale·표시 시간대는 현재 계정에 저장해 그 사용자의 다른 설치와 공유한다. OS 권한·채널·설치 상태는 `INSTALLATION`이며 현재 기기에서만 관리한다. `REMINDER` 값은 이 화면에 복제하지 않고 Reminder 편집에 둔다.
- 기기별 권한이 거부되어도 기본 업무 기능은 계속 이용할 수 있다. 앱은 OS 상태를 설명하고 OS 설정으로 이동한다.
- locale 메뉴에는 한국어와 영어를 보이며, 저장 사용자 locale 우선 → 지원되는 기기 locale → `ko-KR` 기본값 순서를 따른다.

## 운영 흐름 경계

주간 보고와 즉시 장애 알림은 제품 요구사항에 포함된 서비스 운영 기능이다. 이 화면 세트에는 운영자 계정·콘솔·수신 설정을 추가하지 않는다. 운영자 자격, 보고 내용·시간대, 장애 기준·중복 억제, 수신자·채널·재시도는 Q-064 후속 설계에서 결정한다.

## 텍스트 대체 설명

앱은 초대 수락 뒤 `할 일`을 기본 화면으로 연다. 사용자는 세 할 일 보기와 별도 `이력`·`보관함`을 사용한다. Reminder 생성 화면에서 요청자·담당자, TIME 또는 LOCATION, 반복, 선택적 검증을 설정한다. 상세 화면은 상태와 조건을 보여주고 이력·보관함은 기존 결정의 기본 범위·정렬을 따른다. 설정은 Household·User·Installation으로 구분하고 Reminder 값은 해당 편집 흐름에 둔다. 모든 화면은 가용 폭에 맞춰 재배치되며 고정 지원 최소 폭을 요구하지 않는다.
