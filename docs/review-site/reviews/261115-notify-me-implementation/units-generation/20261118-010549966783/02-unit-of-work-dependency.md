---
layout: review
title: "작업 단위 의존 관계"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/units-generation/unit-of-work-dependency.md"
permalink: "/reviews/261115-notify-me-implementation/units-generation/20261118-010549966783/02-unit-of-work-dependency/"
---

# 작업 단위 의존 관계

## Sources

승인된 도메인 설계의 `components.md`, `decisions.md`와 `requirements.md`, `stories.md`를 기준으로 작성했다.

## Dependency DAG

```yaml
units:
  - name: u1-core-flow
    kind: service
    depends_on: []
  - name: u2-household-and-settings
    kind: service
    depends_on: [u1-core-flow]
  - name: u3-reminder-workflows
    kind: service
    depends_on: [u1-core-flow, u2-household-and-settings]
  - name: u4-android-notifications
    kind: service
    depends_on: [u1-core-flow, u2-household-and-settings, u3-reminder-workflows]
  - name: u5-operations-and-recovery
    kind: service
    depends_on: [u1-core-flow, u3-reminder-workflows]
```

## Integration Points

| 소비 단위 | 제공 단위 | 계약에서 명시할 책임 |
| --- | --- | --- |
| U2 | U1 | 초기 스키마, 사용자·가구 접근, 공용 API 및 웹 |
| U3 | U1, U2 | 업무 저장소 및 화면과 권한·설정 정책. U3 명령은 U2가 제공하는 변경에 맞춰 배정과 장소 정책 영향을 같은 트랜잭션에서 적용한다. |
| U4 | U1, U2, U3 | 공유 웹, 계정·가구 인가, 변경 피드 및 설치 대상. U4의 용량 확인과 계획 저장은 U3 명령에 등록한다. |
| U5 | U1, U3 | 서버 실행·DB 접근, 백업의 일관된 기준 위치, 복원 시 필요한 삭제 기록과 재적용 규칙 |

서버에서 함께 저장해야 하는 쓰기는 하나의 트랜잭션에 넣는다. OS 기능과 FCM 신호는 커밋 뒤 반영한다. 교환 데이터, 실패와 재시도 방식은 Contract Design에서 명시한다.

### U3에서 U5로 전달하는 복구용 삭제 기록

1. **삭제 시작과 확정.** U3는 운영 DB를 변경하기 전에 복원 대상 DB와 독립된 복구 기록에 삭제 요청을 내구성 있게 남긴다. 운영 DB 삭제를 커밋한 뒤 같은 요청의 확정 기록을 내구성 있게 저장한다. 둘 다 확인된 뒤 성공을 응답한다.
2. **실패와 재실행.** 요청 식별자로 재실행을 같은 삭제에 연결한다. DB 변경 후 확정 기록 이전에 중단되면 원본의 커밋 증거를 확인해 확정을 재시도한다. 커밋 여부를 확인할 수 없는 요청은 미확정으로 유지하며, 복구 시 이를 임의 적용하거나 건너뛰지 않는다.
3. **완전성 검증.** U5는 일관된 백업과 함께 저장한 기준 위치부터 복구 시작 시점의 신뢰 가능한 종료 위치까지 연속된 목록이나 동등한 누락 검증 수단으로 확인한다. 백업에 반영되지 않은 확정 삭제를 멱등하게 재적용하고 삭제된 데이터가 제공되지 않는지 확인한다. 필요한 기록 누락, 무결성 오류, 결과 미확정, 재적용 실패가 있으면 데이터 제공을 차단한다.
4. **보존 범위.** 적용 대상은 승인된 보존 기간 내 복구 백업이다. 동기화 표지는 리마인더 ID와 삭제 revision으로 제한한다. 복구 검증용 순서·상태 정보는 별도 운영 메타데이터로 제한하고 원문을 저장하지 않는다. 백업과 삭제 표지의 최대 30일 보존 정책을 적용한다.

복구 기록은 U3가 제공하는 논리 경계다. U5는 그 경계를 읽어 검증한다. 저장 위치, 커밋 증거와 누락 검증 자료의 형식은 Contract Design과 후속 상세 설계에서 정한다.

## Integrated Slice and Parallel Work

U1은 독립된 개발 환경에서 인가된 웹 요청이 API와 실제 SQLite까지 도달하고 재조회로 이어지도록 구성한다. 해당 실행은 U2~U5의 코드에 기대지 않는다.

U4와 U5는 공통 선행 단위를 사용할 수 있게 되면 독립적으로 빌드하고 검증할 수 있다. 운영 단위가 받는 상태는 U1과 U3의 서버 경계에서 제공한다. Android 실행 경로 특유의 운영 신호가 후속 설계에서 요구되면 계약과 의존 관계를 다시 검토한다. 작업 일정과 우선순위는 Delivery Planning에서 정한다.
