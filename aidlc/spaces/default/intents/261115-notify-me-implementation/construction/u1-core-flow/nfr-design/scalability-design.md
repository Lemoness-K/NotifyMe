# U1 단일 노드 용량 설계

## Sources

U1의 `functional-spec.md`, `contract-summary.md`, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`를 기준으로 한다.

## Capacity controls

브라우저의 정적 파일과 API를 같은 배포 환경에서 제공한다. API와 저장소는 단일 대상 노드의 실행 역할로 분리한다. 업무 데이터를 가구 범위로 유지하는 질의와 제한된 페이지, 잠금 시간을 제한하는 트랜잭션으로 동시 요청을 처리한다. 부하가 가용 자원을 넘으면 제한 실패와 재시도 지침을 반환한다. 가구·주체 기준 접근 조건은 용량을 이유로 우회하지 않는다.

서버 응답, 메모리, 저장장치 쓰기량과 DB 잠금 횟수를 측정한 뒤 병목을 확인한다. 먼저 읽기 경로와 트랜잭션을 조정한다. 대상 부하와 장치 예산을 넘어서면 개발자가 증거를 기록하고 노드 자원 조정과 데이터 경계 재설계를 별도로 검토한다. MVP에는 별도 분산 저장소나 자동 수평 확장 구성을 두지 않는다.
