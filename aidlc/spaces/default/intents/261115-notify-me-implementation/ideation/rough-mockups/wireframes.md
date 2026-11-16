# Notify Me 저충실도 화면 구성

## 목적과 기준

이 문서는 초기 화면 정보 구조와 업무 화면의 저충실도 구성을 제시한다. 사용자 흐름은 기존 [의도서](../intent-capture/intent-statement.md), 승인된 [범위 정의](../scope-definition/scope-document.md), [마스터 설계](../../../../../../../docs/00-master-design.md), [제품 요구사항](../../../../../../../docs/01-product-requirements.md), 그리고 [할 일·이력·보관함 화면 설계 초안](../../../../../../../docs/designs/task-history-and-archive-screens.md)을 따른다.

기본 진입은 `할 일`이다. 주요 내비게이션은 `할 일`·`이력`·`보관함`이며, 태블릿·데스크톱의 배치와 정확한 breakpoint는 후속 상세 설계에서 정한다 (`D-079`, `PR-AC-064`, `DS-002`, `DS-005`). 이번 단계에서는 색상·서체·브랜드를 확정하지 않는다.

## 향후 UI 가이드에 대응하는 구조

사용자가 요청한 방향은 **“현재 ui가이드는 별도로 없지만, 추후 가이드를 주었을 때 큰 코드 수정 없이 view만 수정되도록 구조 설계를 추가해줘.”**다. 따라서 시각 가이드의 값과 모양을 화면 표현 계층에 모으고, 업무 동작과 상태 규칙이 특정 화면 배치나 장식에 묶이지 않도록 한다.

```text
Future UI Guide
       |
       v
View tokens (color, typography, spacing)
       |
       v
Shared visual components
       |
       v
Screen views and responsive layout
       |
       +--> Existing interaction contracts --> Existing business behavior
```

앞으로 시각 가이드는 주로 표현 값과 공통 요소, 화면 배치의 수정으로 적용한다. 화면은 접근 가능한 이름·상태 설명과 기존 동작을 유지한다. 새로운 상호작용이나 업무 규칙을 가이드가 요구한다면 이는 시각 변경과 분리해 별도 요구사항으로 설계한다. 공통 요소와 view의 실제 모듈 경계·기술 선택은 상세 설계 단계에서 확정한다.

| 변경할 수 있는 표현 | 유지할 업무 동작 |
|---|---|
| 색상·타이포그래피·간격·모서리·아이콘 표현 | 로그인·가구 권한·Reminder 상태 전이 |
| 공통 버튼·입력·목록 항목의 시각 표현 | 저장·완료·검증·보관·복원 규칙 |
| 좁은 화면과 넓은 화면의 배치 | 알림 조건·반복 규칙·알림 수신자 |
| 화면별 콘텐츠의 시각적 계층 | API·도메인 동작과 오류의 의미 |

## 정보 구조

- **할 일**: 오늘·예정·기한 초과 항목을 보고, `내 할 일`·`내가 요청한 일`·`가구 전체 보기`를 전환한다. Reminder 추가와 상세 진입이 가능하다.
- **이력**: 완료·놓침·건너뜀 기록을 확인한다. 화면을 새로 열면 현재 담당 Reminder 범위로 시작하고 필요하면 가구 전체로 전환한다.
- **보관함**: 보관된 Reminder를 최근 보관 순으로 확인하고 복원하거나 영구 삭제 확인으로 이동한다.
- **설정**: 가구 설정, 개인 설정, 설치별 권한·기기 상태를 구분한다. OS 권한은 상태와 시스템 설정으로 이동하는 동작을 안내한다.
- **운영 보고**: Q-064에 포함된 주간 보고와 장애 알림은 서비스 운영 흐름이다. 사용자용 앱의 새 운영자 콘솔로 표현하지 않는다. 보고·알림 전달 채널은 미결정이다.

## 화면 구성

### 초대 확인 및 로그인

```text
[Header: Notify Me]
[Main: Household invitation and invited account]
[Primary action: Continue with Google]
[Secondary: Invitation details and help]
```

- 초대받은 사람은 링크에서 지정된 Google 계정으로 로그인하고 가입 확인을 마친다. 초기 Household/Admin 부트스트랩은 공개 UI에 넣지 않는다 (`D-023`, `D-024`, `D-029`, `D-074`).
- **접근성 메모:** `h1`은 초대 수락, 영역은 `header`·`main`; 건너뛰기 링크 다음 키보드 초점은 초대 설명으로 간다. 기본 버튼은 명확한 텍스트 레이블을 가진다.
- **상태:** 확인 중에는 초대 요약을 유지하며 진행 상태를 알린다. 유효하지 않거나 만료된 초대는 원인과 새 초대를 요청할 방법을 텍스트로 안내한다.

### 할 일

```text
[Header: Notify Me | Profile]
[Navigation: Tasks | History | Archive]
[Title: Tasks]                         [Add reminder]
[View: My tasks | Requested by me | Household]
[Overdue]
  [Status] Task title          [Complete]
  Due or place | Assignees | Requester
[Today]
  [Status] Task title          [Complete]
[Upcoming]
  [Status] Task title          [Complete]
```

- 좁은 화면에서는 세 보기 선택을 현재 값이 보이는 선택 메뉴로 바꾼다. 모바일 주요 내비게이션은 화면 하단에 둔다 (`D-078`, `D-079`, `PR-AC-063`, `PR-AC-064`). 넓은 화면에서는 목록 콘텐츠 폭을 제한하고 배치를 후속 설계에서 결정한다.
- 완료 상태는 글자·아이콘·상태 뱃지로 표현하고 색상만으로 구별하지 않는다. 할 일이 없으면 빈 상태 설명과 Reminder 추가 동작을 제공한다.
- **접근성 메모:** `h1`은 할 일, 영역은 `header`·`nav`·`main`; 건너뛰기 링크 다음 키보드 초점은 보기 선택으로 간다. 목록 항목의 제목과 완료 동작은 별도 이름을 가진다.
- **상태:** loading은 목록 자리표시자, 빈 상태는 현재 보기 이름과 다음 동작, 오류는 재시도와 초안 보존을 제공한다. 한 섹션이 비면 빈 섹션 대신 다른 섹션만 표시한다.

### Reminder 생성 및 수정

```text
[Header: Back | Add reminder]
[Title] ______________________________
[Details] ____________________________
[Requester] [Current member v]
[Assignees] [Member A x] [Add member]
[Reminder condition] [Time] [Place]
[Schedule or place details]
[Repeat] [Off v]
[Completion verification] [Off / On]
  [Verifier] [Household member v]       (when On)
[Cancel]                       [Save]
```

- 제목·내용을 입력하고 요청자와 한 명 이상의 담당자를 확인한다. 요청자와 담당자의 기본값은 로그인 사용자다 (`D-069`). 알림 조건은 시간 또는 장소 중 하나를 선택한다 (`D-015`). 반복 설정은 별도 선택 항목이다.
- 완료 검증을 켠 경우 담당자와 다른 가구 구성원을 검증자로 표시한다 (`Q-063`, 의도서). 검증자 권한과 응답 기한 등 확정되지 않은 정책은 새 옵션으로 만들지 않는다.
- **접근성 메모:** `h1`은 리마인더 추가 또는 수정, 영역은 `header`·`main`; 건너뛰기 링크 다음 초점은 제목 입력으로 간다. 모든 입력은 보이는 레이블과 오류 설명을 가진다.
- **상태:** 저장 중에는 중복 제출을 막고 진행 상태를 알린다. 검증 오류·네트워크 실패·위치 용량 오류에서도 사용자가 입력한 값을 보존하고 오류 근처에서 해결 방법과 재시도를 제공한다.

### Reminder 상세 및 완료

```text
[Header: Back | Reminder title]
[Status: Pending / Waiting for verification / Completed]
[Details and schedule]
[Requester] [Assignees]
[Repeat and place details]
[Edit] [Archive] [More]
[Complete]                       (verification is Off)
[Submit for verification]        (verification is On)

[Verifier view while waiting]
[Task summary] [Submitted by member]
[Reject]                       [Approve]
```

- 검증을 끈 회차는 기존처럼 완료 처리한다. 검증을 켠 회차는 담당자의 완료 표시 뒤 검증 대기 상태가 되고, 검증자가 승인하면 완료, 거절하면 미완료로 돌아간다. 응답이 없으면 검증 대기 상태를 유지한다 (`Q-063`, 의도서).
- **접근성 메모:** `h1`은 Reminder 제목, 상태는 `h2`와 텍스트 뱃지로 표시하고 영역은 `header`·`main`; 뒤로 이동 후 이전 항목으로 초점을 돌린다. 검증 동작은 명시적 버튼 이름과 상태 안내를 가진다.
- **상태:** 상세 loading은 구조를 유지한다. 권한·동기화·완료 요청 실패는 실패 원인과 재시도를 보여준다. 회차가 완료되거나 검증 대기일 때 활성 할 일에서 제거되는 상태를 알린다.

### 이력

```text
[Header: Notify Me | Profile]
[Navigation: Tasks | History | Archive]
[Title: History]
[Scope: My assigned reminders | Household]
[Completed] Task title | time | actor
[Missed]    Task title | time | actor
[Skipped]   Task title | time | actor
```

- 완료·놓침·건너뜀을 한 목록에서 발생 시각 최신순으로 보여준다. 항목을 열면 Reminder와 회차 상태 흐름, 주요 변경 이력으로 이어진다 (`D-080`, `D-081`, `D-088`).
- **접근성 메모:** `h1`은 이력, 영역은 `header`·`nav`·`main`; 건너뛰기 링크 다음 초점은 범위 선택으로 간다. 상태명은 아이콘이나 색과 함께 텍스트로 제공한다.
- **상태:** loading 중에도 범위 선택을 유지하고, 빈 상태는 “표시할 이력이 없습니다”, 오류는 범위와 항목을 잘못 바꾸지 않은 채 재시도하게 한다.

### 보관함

```text
[Header: Notify Me | Profile]
[Navigation: Tasks | History | Archive]
[Title: Archive]
[Recently archived reminder] [Restore] [More]
[Earlier reminder]           [Restore] [More]
[More: Permanent delete]
[Confirm: Reminder title and cannot be restored]
[Cancel]                 [Permanently delete]
```

- 최근 보관한 Reminder가 위에 온다. 복원은 활성 업무로 돌리고, 영구 삭제는 제목·복구 불가 안내를 확인한 뒤 명시적으로 진행한다 (`D-084`, `D-089`, `PR-AC-065`).
- **접근성 메모:** `h1`은 보관함, 확인은 `h2`를 가진 대화상자, 영역은 `header`·`nav`·`main`; 대화상자가 열리면 제목으로 초점을 옮기고 닫히면 실행 버튼으로 돌린다.
- **상태:** 빈 보관함에는 설명을 표시한다. 복원이나 삭제 실패는 항목을 유지하고 원인과 재시도 방법을 제공한다.

### 설정

```text
[Header: Back | Settings]
[Navigation: Household | Personal | Device]
[Household settings]
  [Location limits] [Weekly calendar]
[Personal settings]
  [Language] [Time zone]
[Device status]
  [Notifications: Allowed / Not allowed] [Open system settings]
  [Exact alarm: Status] [Open system settings]
  [Location: Status] [Open system settings]
```

- 가구·개인·기기 설정을 구분한다. OS 권한 상태를 읽기 쉽게 보여주고 사용자가 시스템 설정을 열 수 있게 한다 (`D-019`, `D-065`, `D-066`, `D-073`).
- **접근성 메모:** `h1`은 설정, 하위 섹션은 `h2`, 영역은 `header`·`main`·필요 시 `nav`; 건너뛰기 링크 다음 초점은 첫 설정 범주로 간다. 상태는 문자 설명과 동작으로 전달한다.
- **상태:** 읽는 중에는 기존 화면 구조를 유지하고, 값을 저장할 수 없거나 권한을 확인할 수 없으면 해당 항목 옆에 원인과 재시도 방법을 표시한다.

## 공통 표현·접근성 규칙

- 모바일 우선으로 콘텐츠를 재배치한다. 320 CSS px부터 넓은 화면까지 가로 넘침 없이 사용하도록 설계하고, 브라우저와 Android에서 주요 흐름을 공유한다 (`PR-AC-043`).
- 활성 내비게이션과 선택 상태는 색상 외에 텍스트·아이콘·형태로 표시한다. 키보드 초점은 뚜렷하고, 터치 동작에는 충분한 대상 크기와 간격을 둔다.
- 버튼·입력·상태 문구는 한국어 기본 및 영어 locale에서 읽을 수 있는 명시적 레이블을 사용한다. 입력 오류는 원인과 수정 방법을 필드 가까이에 보여준다.
- 사용자용 모든 화면은 WCAG 2.1 AA를 목표로 하며, heading 순서·landmark·키보드 이동·스크린 리더 안내를 후속 상세 설계와 검증에 연결한다.

## 미결정 및 다음 상세화

- 태블릿·데스크톱 내비게이션 배치와 정확한 breakpoint는 `DS-002`, `DS-005`에서 결정한다.
- 완료 검증의 역할 권한, 반복 회차와의 상세 상호작용, 미응답 해소·알림 기준은 `Q-063` 결정의 후속 요구사항·상세 설계에서 구체화한다.
- 주간 운영 보고의 범위·형식, 운영자 식별, 장애 임계 기준·채널은 `Q-064` 후속 설계에서 정한다. 이번 단계에서는 별도 운영자 콘솔을 추가하지 않는다.
- 공유 표현 요소·화면 view와 사용자 동작 계약의 구체적인 구현 경계는 Inception 상세 설계에서 정한다.
