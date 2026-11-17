# Practices Discovery 인터뷰

## Way of Working

이전에 확인된 선택이므로 다시 묻지 않는다.

- 설계 문서 검토는 GitHub Issue에 게시하고, Issue 또는 Codex에서 승인할 수 있다. 어느 한쪽에서 승인하면 Issue를 정리한다.
- PR은 rebase-and-merge 방식으로 병합한다.

## Walking Skeleton

### Q1

먼저 서비스 전체 흐름을 관통하는 최소 동작 버전을 만들까요? walking skeleton은 실제 기능을 만들기 전에 여러 구성요소가 연결되는지 확인하도록 전체 흐름을 최소 형태로 구현하는 것입니다.

- A. 예 — 기능 개발 전에 한 가지 최소 종단 간 흐름을 먼저 구현한다.
- B. 아니요 — 별도 통합 단계를 두지 않고 계획한 기능 단위로 시작한다.
- X. Other (please specify)

[Answer]: A

## Testing Posture

### Q2

테스트를 구현 과정의 어느 시점에 작성할까요? 프로젝트 지침은 가능한 경우 구현 전에 테스트를 먼저 작성하고 실패를 확인하도록 안내합니다.

- A. TDD — 테스트를 먼저 작성하고 가능한 경우 실패를 확인한 뒤 구현한다. (Recommended)
- B. Test-after — 각 계층을 구현한 뒤 그 계층의 테스트를 작성하고 실행한다.
- C. Custom — BDD, ATDD 또는 두 방식을 섞은 순서를 지정한다.
- X. Other (please specify)

[Answer]: A

### Q3

프로젝트 테스트 전략은 전체 커버리지 비율을 일괄 기준으로 두지 않지만, 현재 작업의 classic 기본값은 80 percent line coverage와 병합 전 CI 통과를 요구합니다. 어느 기준으로 진행할까요?

- A. 프로젝트 전략을 따른다 — 변경된 동작과 주요 위험을 검증하고 전체 커버리지 비율은 고정하지 않는다. 기존 테스트와 CI 검증은 통과해야 한다. (Recommended)
- B. classic 기본값을 따른다 — 80 percent line coverage와 병합 전 CI 통과를 적용하고 프로젝트 문서를 나중에 맞춘다.
- C. 이 선택은 보류하고 구현 단계 전에 충돌을 다시 검토한다.
- X. Other (please specify)

[Answer]: X. Other (please specify) — a와 b 둘다; A. 네 — 위험 중심 테스트와 80 percent 기준

## Deployment

### Q4

첫 제품 배포 절차는 어떻게 시작할까요?

- A. Raspberry Pi에 수동으로 배포하고 검증한다. 초기에는 별도 staging 환경이나 자동 배포를 만들지 않는다. (Recommended)
- B. 병합 시 staging에 자동 배포하고 production 반영은 별도 승인을 받는다.
- C. 실제 앱 코드가 생길 때까지 배포 절차 결정을 보류한다.
- X. Other (please specify)

[Answer]: C

## Code Style

### Q5

제품 코드가 처음 생길 때 코드 스타일 도구를 어떻게 정할까요?

- A. 승인된 언어와 프레임워크의 관례에 맞춰 formatter와 linter를 설정하고 초기 CI에서 검사한다. (Recommended)
- B. 언어 관례를 먼저 따르고 실제 코드 패턴이 생긴 뒤 formatter와 linter를 추가한다.
- C. 구현 전에 사용할 formatter와 linter를 지금 지정한다.
- X. Other (please specify)

[Answer]: B

## Follow-up Questions

### Q6 — Testing Posture

A와 B를 둘 다 원하셨다면, 변경 동작과 주요 위험을 검증하면서 80 percent 전체 커버리지 기준도 추가한다는 뜻인가요? 앞서 제시한 A의 고정 비율 없음과는 양립할 수 없어 적용할 기준을 확인해야 합니다.

- A. 네 — 위험 중심 테스트와 CI를 적용하고 80 percent 전체 커버리지 기준도 추가한다.
- B. 아니요 — 위험 중심 테스트와 CI를 적용하되 80 percent 전체 기준은 두지 않는다.
- C. 결정을 보류하고 구현 전에 다시 검토한다.
- X. Other (please specify)

[Answer]: A

## Consolidated Summary

- 설계 문서는 GitHub Issue에 올려 검토하며, Issue 또는 Codex에서 승인할 수 있다. 어느 쪽에서 승인해도 Issue를 정리한다. PR은 rebase-and-merge로 병합한다.
- 실제 기능 구현 전에 서비스 전체 흐름을 관통하는 최소 동작 버전을 먼저 만든다.
- TDD를 적용해 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패하는지 확인한다.
- 변경 동작과 주요 위험을 테스트하고 CI를 통과시키며, 전체 line coverage 80 percent 기준도 적용한다. 기존 테스트 전략 문서가 고정 coverage 비율을 두지 않는다고 하므로 구현 전에 문서와 기준을 조정해야 한다.
- 제품 배포 절차는 앱 코드가 생긴 뒤 결정한다.
- 처음에는 언어 관례를 따르고 실제 코드 패턴이 생긴 뒤 formatter와 linter를 추가한다.

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
