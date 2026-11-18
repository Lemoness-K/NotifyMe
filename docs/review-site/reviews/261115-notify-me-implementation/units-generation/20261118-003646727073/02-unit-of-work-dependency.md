---
layout: review
title: "작업 단위 의존 관계"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/units-generation/unit-of-work-dependency.md"
permalink: "/reviews/261115-notify-me-implementation/units-generation/20261118-003646727073/02-unit-of-work-dependency/"
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
| U5 | U1, U3 | 서버 실행·DB 접근, 복구 도중 필요할 최신 삭제 표지와 재적용 규칙 |

서버에서 함께 저장해야 하는 쓰기는 하나의 트랜잭션에 넣는다. OS 기능과 FCM 신호는 커밋 뒤 반영한다. 교환 데이터, 실패와 재시도 방식은 Contract Design에서 명시한다.

## Integrated Slice and Parallel Work

U1은 독립된 개발 환경에서 인가된 웹 요청이 API와 실제 SQLite까지 도달하고 재조회로 이어지도록 구성한다. 해당 실행은 U2~U5의 코드에 기대지 않는다.

U4와 U5는 공통 선행 단위를 사용할 수 있게 되면 독립적으로 빌드하고 검증할 수 있다. 운영 단위가 받는 상태는 U1과 U3의 서버 경계에서 제공한다. Android 실행 경로 특유의 운영 신호가 후속 설계에서 요구되면 계약과 의존 관계를 다시 검토한다. 작업 일정과 우선순위는 Delivery Planning에서 정한다.
