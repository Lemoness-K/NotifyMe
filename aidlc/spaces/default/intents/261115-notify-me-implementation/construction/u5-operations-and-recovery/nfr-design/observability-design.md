# U5 observability-design

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR10.1.5. 호스트 상태 명령은 서비스·로컬 헬스·디스크·RSS와 최근 작업의 상태를 조회한다. 운영 이벤트는 SQLite 외부에 보호된 로컬 상태로 기록하고 결정적 이벤트 ID를 출력한다. 재실행에서 같은 보고 주기와 장애 시작을 같은 ID로 식별하며 journald 중복 출력은 이 ID로 합친다.
- NFR10.2.5. 요청 ID와 코드, 건수 및 시각을 남긴다. 데이터·키·세션·제목·좌표를 출력하지 않는다. 운영 소켓 또는 명령을 기존 공개 Caddy 라우트에서 차단한다.
