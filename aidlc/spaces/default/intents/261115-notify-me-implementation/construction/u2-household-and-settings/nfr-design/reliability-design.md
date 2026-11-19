# U2 신뢰성 설계

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

- 가구별 권한 재검사와 조건부 상태 변경을 같은 저장 쓰기 경계에서 수행한다. 초대 소비와 소속, 관리자 인계, 제거 시 실제 활성 배정 종료, 정책과 영향 목록의 저장은 원자적이다. 쓰기 실패 시 롤백하고 인증된 요청의 동일 키는 부수효과를 반복하지 않는다.
- 최초 발급 링크는 저장하지 않는다. 재시도 결과에는 기존 발급의 안전한 식별 정보만 남기고 새 링크의 발급은 명시적 취소 뒤 새 작업으로 받는다. 다른 입력의 같은 키는 409로 거절한다. 읽기와 쓰기는 429·503의 `Retry-After`를 적용한다.
- 만료 시각에 사용을 즉시 막는다. U2 서버가 시작할 때와 이후 기본 5분마다 미삭제 만료 이메일을 정리한다. 각각 서버 UTC 시각으로 비교한다. 동일 코드의 수락·취소 요청과 경합하면 유효 상태 검사와 트랜잭션으로 해결한다. 서비스 중단 뒤 재시작 시 밀린 항목을 먼저 잡는다. 이미 종결된 초대의 이메일은 읽기 경로에 반환하지 않는다.
- 표시 시간대 변경은 일정 instant와 규칙의 IANA zone을 유지한다. 기존 DB를 마이그레이션할 때 기본값을 보존하고 제거된 소속과 기본 설정 값을 회귀 확인한다.
