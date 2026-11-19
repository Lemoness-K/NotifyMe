# U2 신뢰성 요구사항

## Sources

U2 `functional-spec.md`와 `rules.md`, Inception `requirements.md`와 `contract-summary.md`, CodeKB `technology-stack.md`를 근거로 한다. 현재 실행 스택은 U1의 `package.json`, `package-lock.json` 및 `docs/u1-local-run.md`에서 확인했다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR3.1.2 | 초대 소비와 계정·소속 생성, 마지막 Admin 인계와 제거, 소속·실제 활성 배정 종료, 정책과 관련 Trigger 갱신은 각 명령 안에서 원자적으로 처리한다. | 저장 단계마다 실패를 넣고 재시작 뒤 부분 변경이 없음을 검증한다. U2 실제 U1 배정으로 제거를 검증하고 U3/U4 연결은 해당 단계에서 입증한다. |
| NFR3.2.2 | 동일 키 재요청은 부수 효과를 반복하지 않는다. 초대 발급은 링크 1회 노출을 지키면서 기존 초대의 안전한 식별 정보와 취소·재발급 경로를 제공한다. 입력이 다르면 충돌 처리한다. | 요청 경합, 저장 성공 뒤 응답 유실, 다른 입력, 역할 회수 후의 재요청에 대해 중복 발급/소비/저장이 없는지 확인한다. |
| NFR4.1.2 | Household 기본 시간대, User 표시용 IANA 시간대, 이미 저장된 일정의 기준 시간대를 분리한다. 초대 만료 비교는 서버 UTC instant를 사용한다. | 프레젠테이션과 계정 시간대를 바꿔도 기존 일정 instant와 24시간 초대 기한이 유지되는지 검증한다. |
