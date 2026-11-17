# 사용자 스토리 계획 및 질문

## 계획 초안

- **Persona 접근**: 가구 구성원을 기본 사용자로 두고 요청자·담당자 맥락을 표현한다. Admin 전용 권한은 역할 변형으로 드러내고, 별도 업무 목표가 있는 서비스 운영자는 독립 persona 후보로 둔다.
- **형식**: `As a [persona], I want [goal], so that [benefit]` 형식과 INVEST를 적용한다. Acceptance Criteria에는 독립적으로 확인할 수 있는 Given/When/Then 조건과 안정 ID를 둔다.
- **우선순위**: 각 스토리에 MoSCoW를 부여해 요구사항상 가치와 선후관계를 표시한다. 정식 MVP 경계는 Delivery Planning에서 결정한다.
- **분해 후보**: 사용자 여정/workflow, persona, 기능·domain area, epic/feature 기준을 비교한다. 권고안은 end-to-end 사용자 흐름별 epic 안에 작고 독립적인 story를 두는 방식이다.
- **미결정 정책**: Q-063 완료 검증과 Q-064 운영 보고·장애 알림의 구체적 정책은 기존 열린 질문으로 유지한다. 승인된 기능 포함만 표현하고 세부 동작을 추정하지 않는다.

## Q1. Persona 구성

스토리에서 가구 구성원과 운영자 역할을 어떻게 표현할까요? 요청자와 담당자는 같은 사람이 맡을 수 있고, Admin은 가구 구성원 권한의 한 종류입니다. 운영자 주간 보고·장애 알림의 세부 정책(Q-064)은 아직 열려 있습니다.

- A. 가구 구성원 기본 persona에 요청자·담당자 맥락과 Admin 역할을 표시하고, 서비스 운영자는 별도 persona로 둔다. (Recommended)
- B. Admin, 일반 Member, 서비스 운영자를 각각 별도 persona로 둔다.
- C. 가구 구성원 하나의 persona로 통합하고 Admin·운영자 차이는 권한 설명으로만 둔다.
- X. Other (please specify)

[Answer]: A. 가구 구성원 기본 persona에 요청자·담당자 맥락과 Admin 역할을 표시하고, 서비스 운영자는 별도 persona로 둔다. (Recommended)

## Q2. Story 크기

Acceptance Criteria가 독립적인 결과를 검증할 수 있도록 story를 어느 크기로 나눌까요?

- A. 한 story에 독립적으로 구현·검증할 수 있는 사용자 결과 하나를 둔다. (Recommended)
- B. 여러 결과가 연결된 end-to-end 사용자 여정을 한 story로 묶는다.
- C. 기능 영역별 큰 story를 두고 세부 동작은 Acceptance Criteria에 모은다.
- X. Other (please specify)

[Answer]: A. 한 story에 독립적으로 구현·검증할 수 있는 사용자 결과 하나를 둔다. (Recommended)

## Q3. Story 정리 방식

사용자 흐름, persona, 기능 영역은 서로 다른 방식으로 Story 목록을 묶습니다. 어떤 구성을 선호하나요?

- A. 사용자 여정/workflow별 큰 기능 묶음(epic) 안에 작은 독립 story를 둔다. (Recommended)
- B. persona별로 묶어 각 사용자 역할의 목표 흐름을 따라간다.
- C. 기능·domain area별로 묶어 요구사항과 설계 모듈의 구조를 따른다.
- X. Other (please specify)

[Answer]: A. 사용자 여정/workflow별 큰 기능 묶음(epic) 안에 작은 독립 story를 둔다. (Recommended)

## Consolidated Summary Confirmation

- Persona는 가구 구성원을 기본으로 하고, 요청자·담당자 맥락과 Admin 권한 변형을 표현한다. 서비스 운영자는 별도 persona로 둔다.
- 각 story는 독립적으로 구현·검증할 수 있는 사용자 결과 하나를 담고, Acceptance Criteria를 안정 ID와 함께 Given/When/Then으로 작성한다.
- Story는 사용자 여정/workflow별 epic으로 묶는다. 각 epic 안에는 작고 독립적인 story를 두고 MoSCoW 우선순위를 표시한다. 공식 MVP 경계는 Delivery Planning에서 정한다.
- Q-063(선택적 완료 검증 정책)과 Q-064(운영 보고·장애 알림 정책)의 미결정 세부사항은 열린 상태로 유지한다.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
