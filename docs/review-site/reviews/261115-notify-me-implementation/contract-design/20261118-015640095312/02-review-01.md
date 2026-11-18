---
layout: review
title: "Review 01"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/contract-design/reviews/review-01.md"
permalink: "/reviews/261115-notify-me-implementation/contract-design/20261118-015640095312/02-review-01/"
---

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-18T01:54:11Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/inception/contract-design/contract-summary.md > 1. 웹과 Android가 호출하는 API, listReminders / getReminder / changeOccurrence | 회차 완료·건너뛰기·검증 요청에는 회차 ID와 revision이 필요하지만, 리마인더 목록과 상세에서 반환하는 Reminder에는 회차가 없고 회차 조회 API도 없다. 공유 UI는 새로 연 화면에서 활성 회차와 현재 버전을 확인하여 작업을 보낼 수 없다. FR2.3·FR3.7·FR8.1~FR8.2 회차 작업과 FR5.1 오늘·예정 목록을 같은 읽기 계약으로 연결해야 한다. | 회차 읽기 API나 목록·상세 응답에 회차 뷰를 넣고, 식별자·상태·예정 시각·revision 및 반복 리마인더의 기준 회차를 어떤 응답에서 얻는지 명시한다. | New |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/inception/contract-design/contract-summary.md > 2–5. 서버 내부 인터페이스와 인증 공급자, CandidatePlan / InstallationPlanParticipant | U4가 받아야 할 예약 후보에는 설치 ID·회차 ID·버전·동작만 있다. 새 후보의 실제 시간·장소 조건이 전달되지 않으며, 같은 트랜잭션에서 그 정보를 제공하는 U3의 조회형 포트도 없다. U4가 U3 내부 저장 구조를 직접 참조하거나 아직 커밋되지 않은 조건을 놓칠 수 있다. FR4.8 설치 용량 확인과 예약 계획 저장을 동일 트랜잭션에 묶는 책임을 구현하기 어렵다. | 추가·갱신과 제거의 입력을 구분한다. 후보의 계획 키, 예약 종류·조건, 버전 등 필요한 데이터를 전달하거나 같은 트랜잭션에서 해석하는 U3 포트를 정의하고 Android가 받는 계획 스키마까지 연결한다. | New |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/inception/contract-design/contract-summary.md > 7–8. 삭제 기록과 운영 복구, recovery-delete-journal-v1 | 복원은 includedThrough 이후를 검사하지만, 그 기준점 전에 생성된 REQUESTED가 기준점 이후에 확정되거나 원본 유실로 끝내 미확정인 경우를 어떤 자료로 찾는지 명시하지 않았다. 요청을 기록한 직후 백업을 만들고 DB 삭제 커밋 직후 확정 기록을 쓰기 전에 원본을 잃으면, 백업에는 삭제 전 데이터가 남아 있고 기준점 이후 로그가 비어 있을 수 있다. 이 구간의 연속성만 확인하면 미확정 요청을 놓친다. | 백업 기준점은 그 위치 전의 관련 요청이 모두 확정되고 결과가 스냅샷에 반영됐음을 보증하도록 정의한다. 또는 스냅샷과 별도로 보존한 미확정 요청 목록까지 복구 검사에 넣는다. 어느 경우든 결과를 증명할 수 없으면 데이터 제공을 차단한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| OpenAPI JSON 읽기 검증 | PASS | 작업 ID 25개는 고유하며 스키마 참조가 정의에 연결된다. 회차 ID를 제공하는 읽기 동작은 확인되지 않았다. |

### Summary

연결 구조와 실패 흐름을 도식화했다. 계약을 구현하기 전에 회차의 읽기·쓰기 연결, U3에서 U4로 넘기는 예약 후보 데이터, 백업 기준점에 걸친 미확정 삭제 처리를 구체화해야 한다.
