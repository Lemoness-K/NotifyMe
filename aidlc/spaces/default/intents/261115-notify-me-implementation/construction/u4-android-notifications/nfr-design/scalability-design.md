# U4 scalability-design

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

- NFR5.3.4. 서버 트랜잭션 안에서 설치에 적용할 고유 장소 계획의 순수 수요를 계산한다. 99·100번째 슬롯은 허용하고 101번째는 새 설치에서 CAPACITY_PENDING, 활성 설치에서 D-090 전체 변경 거부로 검증한다. 순서가 바뀐 두 요청도 동일한 용량 조건 아래에서 평가한다.
- 한 기기 OS 사용자에 하나의 활성 계정/가구가 사용하는 슬롯을 계산한다. 계정 교체나 범위 세대 변경 때 이전 예약을 모두 정리한 후 새 지오펜스를 설치한다. 대기 중 수요를 낮추는 제외를 허용하며 복원 시 초과하면 이전 제외를 유지한다. 잠시 OS 적용에 실패한 경우 서버 목표와 기기 관측을 구별한다.
