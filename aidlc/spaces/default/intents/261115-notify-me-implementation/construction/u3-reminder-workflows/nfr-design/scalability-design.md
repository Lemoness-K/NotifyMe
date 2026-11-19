# U3 용량 설계

## Sources

U3의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`와 공통 `contract-summary.md`를 따른다.

- NFR5.3.3. 기존 단일 노드의 Node와 SQLite를 유지하고 반복 처리와 삭제 기록 준비는 같은 서버에서 수행한다. 장기간 이력에는 안정 커서가 있는 페이지를 사용한다. 반복 생성은 가구·업무별로 다음 기준부터 제한된 묶음으로 재실행한다.
- 페이지 기본 크기는 25, 최대 100으로 유지한다. 반복 작업의 처리 묶음은 100개 이하를 기본으로 하되 일시 저장 경쟁 시 횟수를 제한해 재시도한다. 동일 반복 구간을 여러 작업이 다룰 때 고유 회차 키로 중복을 차단한다. 별도 스케줄러나 수평 노드를 도입하지 않는다.
