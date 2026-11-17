# 팀 실천

## Way of Working

- 설계 문서를 GitHub Issue에 게시해 검토한다. Issue 또는 Codex에서 승인할 수 있으며, 어느 쪽에서 승인하든 Issue를 정리하고 닫는다.
- PR은 rebase-and-merge 방식으로 병합한다.
- 구현 전 관련 결정과 설계 문서를 확인한다. 문서와 구현이 다르면 차이를 기록하고, 제품 동작이나 범위 변경은 사용자 결정을 받는다.

## Walking Skeleton

- 기능 구현 전에 서비스 전체 흐름을 관통하는 최소 동작 슬라이스를 먼저 만든다. 이 슬라이스로 주요 구성요소가 연결되어 함께 동작하는지 확인한다.

## Testing Posture

- **Methodology**: tdd
- **Methodology evidence**: 인터뷰에서 TDD를 확정했다. 동작 변경에 대응하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패하는지 확인한다.
- **Ordering**: 변경할 동작과 주요 위험을 검증하는 테스트를 먼저 작성하고, 가능한 경우 구현 전에 실패를 확인한 다음 구현하여 통과시키며 관련 회귀 테스트와 CI를 실행한다.
- 변경 동작과 주요 위험에 초점을 둔 테스트를 작성하고 CI를 통과시킨다.
- 전체 line coverage 80 percent 기준도 적용한다는 사용자의 답변이 확정됐다. 다만 `docs/08-test-strategy.md`는 고정된 전체 coverage 비율을 두지 않는다고 명시하므로 두 기준의 불일치를 구현 전에 조정해야 한다. 이 단계에서는 설계 문서를 수정하지 않았고 기준 간 정합성을 해결된 것으로 간주하지 않는다.
- 테스트에는 synthetic data와 로컬 테스트 리소스를 사용하며 운영 데이터나 운영 자격 증명을 사용하지 않는다.

## Deployment

- 제품 배포 정책은 앱 코드가 생긴 뒤 결정한다.
- 문서에 기록된 Raspberry Pi, systemd, journald, Caddy 구성은 계획이며 실제 배포 관행이나 승인된 제품 배포 cadence로 보지 않는다. GitHub Actions의 리뷰 Issue/Pages 워크플로도 제품 배포 정책을 정하지 않는다.

## Code Style

- 초기에는 선택한 언어의 관례를 따른다.
- 실제 제품 코드 패턴이 생긴 뒤 필요에 맞춰 formatter와 linter를 추가한다. 현재 도구나 구체 naming 규칙은 확정하지 않는다.
