# U5 performance-requirements

## Sources

`functional-spec.md`와 `rules.md`, `requirements.md`, `contract-summary.md`, `technology-stack.md`를 따른다.

## Requirements

- NFR5.1.5. 백업 중 대표 API의 p95 500ms는 대상 Pi와 DS-014 조건에서 측정한다. 대기·실패한 백업 실행의 소요도 별도로 기록한다.
- NFR5.2.5. 백업 암호화·DB 복사·복원·원장 처리의 peak RSS와 쓰기량은 DS-014 기준에서 확인한다. 사본을 만들 때 DB 크기에 비례해 전체를 메모리에 올리는 방식을 피한다.
