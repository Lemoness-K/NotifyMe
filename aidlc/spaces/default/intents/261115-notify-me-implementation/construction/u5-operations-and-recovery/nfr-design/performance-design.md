# U5 performance-design

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR5.1.5. SQLite 온라인 사본 생성과 최신 경계 일치 검증까지 삭제를 잠시 대기시킨다. 암호화·보관은 확인한 격리 사본을 대상으로 경계 밖에서 실행한다. 경계가 만료되면 후보를 버린다. DS-014에서 백업 중 p95와 최대 차단 시간을 분리해 측정한다.
- NFR5.2.5. 스냅샷과 암·복호화는 파일 스트림을 사용한다. 진행은 건수와 시간으로 기록하고 대상 Pi의 RSS와 쓰기량은 DS-014에서 측정한다.
