# U5 scalability-design

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR5.3.5. 기존 단일 API/Worker의 삭제 원장 쓰기 소유권을 유지한다. 외부 백업 명령은 실행 중인 쓰기 소유자의 로컬 전용 작업 경계로 요청하며 DB 파일을 임의로 복제하지 않는다. 복구는 기존 쓰기 소유자를 중단시킨 배타 운영 절차다. 백업 실행과 원장 정리는 서로 배타적이다.
