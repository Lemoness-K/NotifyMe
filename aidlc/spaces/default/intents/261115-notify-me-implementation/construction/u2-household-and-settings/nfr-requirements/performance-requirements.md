# U2 성능 요구사항

## Sources

U2 `functional-spec.md`와 `rules.md`, Inception `requirements.md`와 `contract-summary.md`, CodeKB `technology-stack.md`를 근거로 한다. 현재 실행 스택은 U1의 `package.json`, `package-lock.json` 및 `docs/u1-local-run.md`에서 확인했다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR5.1.2 | 구성원 목록과 설정의 대표 요청 p95 목표는 대상 Raspberry Pi에서 500ms 이하로 유지한다. U1의 인증 비용을 포함한 보호 경로로 측정하고 공급자 가용성 변화가 섞인 실행과 기준선 실행을 구분한다. | DS-014가 장치·데이터량·동시 요청·측정 구간을 고정한 뒤 측정한다. 개발 호스트 값은 기준선이다. |
| NFR5.2.2 | 승인된 최대 메모리·저장장치 쓰기 예산을 포함해 U2 요청과 만료 정리의 증가량을 측정한다. | DS-014에서 수치가 확정되기 전 대상 적합성 판정은 보류한다. 정리 작업 실행과 일반 요청 구간을 표기한다. |
