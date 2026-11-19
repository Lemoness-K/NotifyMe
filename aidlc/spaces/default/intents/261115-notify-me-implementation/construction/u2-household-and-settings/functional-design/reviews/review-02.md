## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-18T23:20:41Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/functional-spec.md > 초대 발급·수락·회수 1·7단계 | 동일 작업 키의 재요청으로 서버 비밀과 식별자에서 코드를 다시 만들어 응답하도록 설계했다. `docs/07-security-and-privacy.md` §3은 CSPRNG로 생성한 코드 원문을 발급 때 한 번만 표시한다. 반면 공통 쓰기 계약은 같은 키에 같은 결과를 요구하고 발급 응답 스키마에는 `inviteUrl`이 필수다. 개발자가 현 명세대로는 어느 쪽을 적용해도 다른 쪽을 위반한다. | 초대 발급에 맞는 재시도 응답과 복구 흐름을 정한다. 원문 재노출을 금지하는 정책을 유지한다면 안전한 기존 발급 결과와 취소·재발급 방법을 계약에 명시한다. 동일 원문 재전송을 허용하려면 보안 정책 변경을 먼저 확정한다. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/entities.md > Invitation.target_email 및 aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/functional-spec.md > 초대 상태 전이 | 대상 이메일을 모든 상태에서 필수로 선언했고 만료는 시각으로만 파생한다. `docs/02-domain-and-data-design.md` §4.1와 `docs/07-security-and-privacy.md` §3.1은 수락·취소·만료 시 대상 이메일을 삭제하도록 한다. 만료한 초대를 다시 조회하지 않는 경우에는 이메일 삭제 경로도 없다. | 대상 이메일은 활성 초대에만 필수로 하고, 수락·취소 트랜잭션에서 삭제한다. 조회가 없는 만료 건도 삭제하는 경계를 정의하고 재시도 결과는 이메일에 의존하지 않게 한다. | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/functional-spec.md > 초대 상태 전이 및 역할과 구성원 제거 2단계 | 마지막 Admin 제거에는 후임 ID가 필요하지만 현재 제거 DELETE는 `If-Match`와 작업 키만 받는다. 초대 취소에는 최신 revision을 요구하지만 취소 요청 및 초대 발급 응답에 revision 필드가 없고 초대 상태 조회 경로도 나와 있지 않다. 폼에서 필요한 입력을 보내거나 읽을 수 없다. | 원자적 Admin 제거에 후임 ID가 들어가는 요청 형식을 정의한다. 초대 취소는 조건부 유효 상태 갱신으로 충분한지 정하거나 revision을 얻고 보내는 계약을 맞춘다. 초대 관리 화면이 리로드 뒤 사용할 조회 경로도 명시한다. | Unresolved |
| R-04 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/functional-spec.md > 역할과 구성원 제거 3단계 | 연결 전 효과를 계약 대역으로 검증하되 실제 데이터가 있으면 생략을 금지한다고 했다. `src/server/repository.ts`의 U1 등록 경로는 이미 Assignment를 저장하고 조회에 반영한다. U2에서 실제 배정을 정리할 참여자가 없으면 사용 가능한 데이터에서 제거가 실패하거나, 모의 통과 후 배정이 남는다. | U2 단독 완료 시 U1의 실제 배정 종료 처리를 동일 트랜잭션에 연결하고 배정이 있는 구성원 제거를 검증한다. U3·U4 이후 효과의 교체 또는 연결 지점과, 해당 데이터·기능이 없는 경우의 동작을 구분한다. | Resolved (reviewer) |

> R-01 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/functional-spec.md의 초대 1·7단계가 최초 원문 1회, 구조화된 409의 기존 ID·만료 시각, 명시적 취소 및 새 키 발급을 정의한다. OpenAPI의 발급 응답 예외는 구현 계획에 반영해야 한다.

> R-02 Reviewer note: Invitation의 이메일은 활성 초대에만 필요하다. 사용·취소와 함께 지우고, 만료 정리 작업은 재조회 없이도 이메일을 삭제한다. 재시도 기록은 이메일 원문을 보존하지 않는다.

> R-03 Reviewer note: 후임 ID는 제거 요청의 선택 쿼리로 정의됐고 초대 취소의 클라이언트 revision 의존도 제거됐다. 다만 aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u2-household-and-settings/functional-design/frontend-components.md의 초대 관리에는 발급 화면을 닫거나 새로 고친 뒤 여전히 유효한 초대의 상태·ID를 찾아 취소하는 흐름이 없다. 현재 API에는 발급·취소·수락만 있어 관리자가 원문 없이 대상과 상태를 확인하는 기존 보안 설계의 동작을 지원할 조회 방식이 필요하다.

> R-04 Reviewer note: 구성원 제거에 실제 U1 Assignment 저장소를 연결하고 소속 및 배정 변경을 원자적으로 처리한다. U3 업무 구현과 U4 설치 구현의 연결 시점이 구분됐고 실제 배정 저장 실패는 제거도 실패시킨다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage functional-design` | PASS, findings_count 0 | U2에 배정된 수용 기준 35건의 연결을 확인했다. |

### Summary

초대 비밀과 개인정보의 수명주기, 인계 입력, 실제 배정 종료 경계가 보완됐다. 초대 관리 화면을 다시 열었을 때 기존 초대를 찾는 조회 방식은 보완이 남아 있다.
