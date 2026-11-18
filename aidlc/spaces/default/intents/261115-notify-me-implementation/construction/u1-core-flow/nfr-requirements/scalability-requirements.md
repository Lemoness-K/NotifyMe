# U1 용량과 확장 요구사항

## Sources

U1의 `functional-spec.md`, `rules.md`, Inception `requirements.md`, `contract-summary.md`와 CodeKB `technology-stack.md`를 기준으로 한다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR5.3.1 | MVP는 단일 노드에서 초기 설정과 사용자·가구 요청을 실행한다. 인가와 가구 범위는 데이터 모델에서 유지한다. | 외부 분산 노드 없이 통합 흐름을 재현한다. 둘 이상의 동시 초기화나 업무 요청에서도 일회성과 가구 범위를 유지한다. 목표 동시 요청량은 DS-014에 기록한다. |
