# U1 성능 설계

## Sources

U1의 `functional-spec.md`, `contract-summary.md`, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`를 기준으로 한다.

## Access path

- 조회는 가구와 승인된 현재 회차 조건을 먼저 적용한다. 목록은 제한된 페이지와 안정된 정렬 키·커서를 사용하고, 가구·정렬·참조 조건에 맞는 인덱스를 둔다. 화면에 필요한 필드와 기준 회차만 한 번에 조회하여 항목별 추가 읽기를 줄인다.
- 권한 결과와 업무 응답을 공유 캐시에 두지 않는다. 정적 웹 파일의 캐시는 버전이 바뀌면 교체할 수 있다. 인증 공급자 검증의 시간 제한과 재시도 범위는 서버 설정에서 확인하고 보호 응답으로 우회하지 않는다.
- 쓰기는 가구 권한 확인, 업무와 회차 저장, 작업 키 결과 커밋을 한 개의 짧은 트랜잭션으로 묶는다. 외부 공급자 호출은 쓰기 잠금 밖에서 처리한다.

## Measurement

DS-014에서 대상 Pi, 데이터량, 동시성, 워밍업과 측정 구간을 고정한다. 주요 화면 요청의 p95 목표는 500ms다. 인증 확인·DB I/O·응답까지 경로별로 측정한다. 최대 메모리와 저장장치 쓰기 예산은 정해진 수치와 비교한다. 개발 환경의 시간은 회귀 확인에 사용하며 Pi 기준의 합격 증거는 대상 환경에서 얻는다.
