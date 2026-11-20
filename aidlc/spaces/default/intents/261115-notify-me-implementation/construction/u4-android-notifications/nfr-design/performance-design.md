# U4 performance-design

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

- NFR5.1.4. 설치·epoch·revision 인덱스에서 변경분을 읽고 전체 계획과 후보 페이지를 분리한다. DS-014에서 대표 sync와 용량 목록의 p95 500ms를 측정한다.
- NFR5.2.4. 계획/이벤트 전송은 유한 배치로 처리하고 중복 조회를 합친다. Pi 피크 RSS와 쓰기량은 확정된 DS-014 부하에서 별도로 측정한다.
