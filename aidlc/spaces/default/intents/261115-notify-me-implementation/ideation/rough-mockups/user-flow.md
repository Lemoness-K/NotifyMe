# Notify Me 핵심 사용자 흐름

## 범위와 출처

이 흐름은 [의도서](../intent-capture/intent-statement.md), [범위 정의](../scope-definition/scope-document.md), [우선순위 백로그](../scope-definition/intent-backlog.md), [제품 요구사항 §3](../../../../../../../docs/01-product-requirements.md#3-핵심-사용자-흐름), [마스터 설계](../../../../../../../docs/00-master-design.md), 그리고 [기존 할 일·이력·보관함 화면 설계](../../../../../../../docs/designs/task-history-and-archive-screens.md)를 연결한다. 미결정 정책은 별도 표시하며 새 제품 규칙으로 승격하지 않는다.

## 정보 흐름 요약

```text
Invitation -> Sign in -> Household tasks -> Create reminder
    -> Assign requester and assignees -> Set one reminder condition
    -> Receive reminder -> Complete or submit for verification
    -> View completion history

Service health -> Weekly report to operator
Service health -> Incident criteria -> Immediate operator alert
```

**텍스트 대체 설명:** 초대받은 구성원은 로그인해 가구에 참여한 후 부탁을 기록하고, 요청자·담당자와 알림 조건을 지정한다. 담당자는 알림을 확인하고 일을 완료하거나 선택적 검증을 요청한다. 완료 결과는 이력에 남는다. 별도로 서비스 상태에서 운영자 주간 보고와 장애 알림이 만들어지며, 세부 판정과 전달 방식은 미결정이다.

## 흐름 1 — 초대를 받아 가구에 참여

**Persona:** 초대받은 가족 구성원.  
**Trigger:** Admin이 공유한 초대 URL을 연다.

```text
Open invitation -> Review household and invited account
    -> Continue with Google -> Confirm membership
    -> Register Android installation when applicable
    -> Review notification and location permissions
    -> Load active reminders -> Tasks
```

1. 초대 URL은 지정된 Google 계정으로 로그인 또는 가입을 안내한다. 사용자는 코드를 수동 입력하지 않고 링크에서 가구 가입을 확인한다 (`D-023`, `D-024`, `D-029`).
2. Android 앱은 설치 상태와 capability를 등록하고 권한 상태를 설명한다. 사용자는 필요한 경우 Android 설정을 직접 연다.
3. 가입이 끝나면 활성 업무를 동기화한 뒤 `할 일` 화면을 연다. 브라우저는 같은 업무 UI를 제공하고 네이티브 백그라운드 기능 지원 여부를 분명히 알린다.

**성공 결과:** 구성원이 로그인되고 가구의 `할 일` 화면을 본다.  
**오류·복구:** 로그인 실패 또는 사용할 수 없는 초대는 원인을 텍스트로 표시하고 다시 로그인하거나 Admin에게 초대를 요청하는 경로를 제공한다. 권한 거부 상태에서도 기능 상태와 설정 이동을 안내하며 저장 동작은 기존 정책을 따른다.

## 흐름 2 — Reminder를 만들고 알림 조건을 설정

**Persona:** 자신 또는 다른 가구 구성원에게 부탁을 남기는 가구 구성원.  
**Trigger:** `할 일` 화면에서 `Reminder 추가`를 선택한다.

```text
Tasks -> Add reminder -> Enter title and optional details
    -> Confirm requester and one or more assignees
    -> Choose TIME or LOCATION
    -> Add optional recurrence
    -> Choose optional completion verification
    -> Review and save -> Updated tasks
```

1. 제목과 선택적 내용을 적는다. 생성자는 로그인 사용자로 기록하고 요청자·담당자 기본값도 현재 사용자로 둔다 (`D-069`).
2. 요청자는 가구 구성원으로 바꿀 수 있다. 담당자는 한 명 이상 선택한다.
3. 알림 조건은 날짜·시간 또는 장소 중 하나를 선택한다. 장소 조건은 위치와 반경을 입력하며, 반복 조건은 선택 사항이다 (`D-015`).
4. 완료 검증은 Reminder별 선택 기능이다. 활성화하면 담당자와 다른 가구 구성원을 검증자로 선택하는 흐름을 나타낸다 (`Q-063`, 의도서).
5. 저장 후 확인된 Reminder를 활성 목록에 표시한다. 연결된 담당자 설치는 새 회차와 알림 조건을 반영한다.

**성공 결과:** Reminder가 저장되고 선택한 보기에서 확인된다.  
**오류·복구:** 필수 입력 오류는 해당 입력 가까이에서 설명한다. 연결·저장 실패 또는 위치 용량 초과는 입력값을 유지하고 원인과 다음 동작을 보여준 뒤 재시도하게 한다.

## 흐름 3 — 알림을 확인하고 회차를 완료

**Persona:** 현재 회차를 수행하거나 검증하는 가구 구성원.  
**Trigger:** 할 일 목록 또는 Android 시스템 알림에서 Reminder를 연다.

```text
Open reminder -> Read title, condition and assignment
    -> Mark complete
    -> Verification enabled?
         No -> Record completion -> Remove from active tasks -> History
         Yes -> Waiting for verification -> Notify verifier when applicable
                   -> Approve -> Record completion -> History
                   -> Reject -> Return occurrence to pending -> Tasks
                   -> No response -> Keep waiting state
```

1. 시스템 알림을 누르면 해당 Reminder 상세를 연다. 앱 안에서 상태와 담당자·요청자를 확인한다.
2. 검증이 꺼져 있으면 완료 시 담당자와 시각을 기록하고 활성 미완료 목록에서 제거한다 (`D-010`, `D-013`).
3. 검증이 켜져 있으면 완료 표시는 검증 대기 상태를 만든다. 검증자는 승인 또는 거절을 선택한다. 승인 후 완료 이력에 반영하고, 거절하면 미완료 상태로 되돌린다. 응답이 없는 동안 검증 대기 상태를 유지한다 (`Q-063`, 의도서).

**성공 결과:** 사용자는 현재 상태를 목록과 이력에서 확인하고, 회차 기록은 완료자·시각과 함께 보존된다.  
**오류·복구:** 저장 또는 네트워크 오류는 서버 결과를 확정된 것처럼 표시하지 않는다. 최신 상태를 다시 불러오고 사용자가 다시 시도할 수 있게 한다.

**미결정:** 검증자 권한 범위, 반복 회차 상호작용, 미응답 만료·재알림과 검증 취소 동작은 후속 요구사항·상세 설계에서 정한다.

## 흐름 4 — 이력과 보관함을 확인

**Persona:** 가구의 완료·미완료 결과를 확인하는 구성원.  
**Trigger:** 주 내비게이션에서 `이력` 또는 `보관함`을 연다.

```text
Open History -> Default to reminders assigned to me
    -> Optionally switch to household history
    -> Open an entry -> Review occurrence and change history

Open Archive -> Browse by most recent archive time
    -> Restore reminder -> Return to active tasks
    -> Or request permanent deletion -> Confirm title and consequence
```

1. 이력은 현재 사용자의 담당 Reminder 범위로 시작하고, 화면에서 가구 전체 이력으로 전환할 수 있다. 주 내비게이션을 떠났다가 다시 열면 기본 범위로 돌아온다 (`D-080`, `D-088`).
2. 완료·놓침·건너뜀은 상태 텍스트를 포함한 하나의 목록에 발생 시각 최신순으로 표시한다 (`D-081`).
3. 보관함은 최근 보관 항목부터 보여준다. 복원은 활성 업무로 돌아가며, 영구 삭제는 제목과 복구 불가 안내를 확인한 뒤 명시적으로 진행한다 (`D-084`, `D-089`).

**성공 결과:** 사용자는 완료 이력과 보관 상태를 확인하고 복원 또는 삭제 흐름을 마친다.  
**오류·복구:** 이력 조회 실패는 현재 범위 선택을 보존하고 재시도를 제공한다. 복원·삭제 실패는 해당 항목을 목록에서 임의로 제거하지 않는다.

## 흐름 5 — 운영 보고와 장애 알림

**Persona:** 서비스 운영자.  
**Trigger:** 주간 집계 시점 또는 서비스 장애 신호.

```text
Service health signals -> Weekly summary -> Deliver report to operator
Service health signals -> Incident criteria met -> Send immediate alert
```

- Q-064에 따라 주간 운영 보고와 장애 발생 즉시 알림을 이번 MVP 범위에 포함한다.
- 이 흐름은 가구 구성원용 화면이나 상용 운영자 콘솔을 정의하지 않는다. 보고 내용, 장애 판정·중복 억제, 수신자와 채널은 미결정이며 후속 요구사항·상세 설계에서 정한다.
- 유료 외부 서비스·새 계정·공개 운영 화면을 필요로 하는 방안은 임의로 선택하지 않는다.

## 접근성 및 향후 UI 가이드 적용

- 화면 view는 키보드·터치 조작, 스크린 리더 이름과 상태 설명, 비색상 상태 구분을 유지한다. 주요 흐름에서는 현재 화면 제목과 다음 동작을 분명히 표시한다.
- 미래 UI 가이드의 시각 조정은 공통 표현 요소와 화면 view에서 처리하고 흐름상의 액션·결과는 유지하는 것을 구조 목표로 둔다. 새로운 업무 동작이 추가되는 경우 시각 변경과 별도 요구사항으로 다룬다.
- 자세한 breakpoint·넓은 화면 배치·기술 구조와 Q-063·Q-064 세부 정책은 후속 상세 설계에서 결정한다.

## 참고 기준

- 할 일·내비게이션·완료 상태: `D-010`, `D-013`, `D-015`, `D-069`, `D-072`, `D-076`, `D-078`, `D-079`, `PR-AC-043`, `PR-AC-056`, `PR-AC-063`, `PR-AC-064`.
- 이력·보관함: `D-080`, `D-081`, `D-084`, `D-088`, `D-089`, `PR-AC-011`, `PR-AC-034`, `PR-AC-065`.
- 완료 검증·운영 보고 및 장애 알림: `Q-063`, `Q-064`, 현재 intent 답변과 승인된 범위.
