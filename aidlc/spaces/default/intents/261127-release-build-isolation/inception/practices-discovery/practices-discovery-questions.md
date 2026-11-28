# DS-030 개발·운영 방식 확인

다섯 영역은 기존 확정 결정과 이번 사용자의 명시적 요청으로 정리할 수 있어 새 일반 질문은 없다. 기존 제품 질문의 상태와 ID는 변경하지 않는다. 아래는 최종 통합 전 확인이며 실제 서비스 전환 승인이 아니다.

근거: `AGENT.md`, `docs/decision-register.md`의 D-070(환경 분리와 개발 루프)·D-071(테스트 우선 구현)·D-077(systemd 감독)·D-104(DS-027 실기기 수용)·D-105(DS-030 선택), `docs/08-test-strategy.md` §3, `docs/09-feature-design-coverage-and-backlog.md` DS-030·§8.8·§8.9, 현재 읽기 전용 [증거 기록](evidence.md).

## Consolidated Summary Confirmation

- 작업 방식: 다른 세션의 미커밋 작업과 DS-027(상태 배지·버튼 구분)을 보존하고, 승인된 단계 산출물만 선별해 취급한다.
- 최소 검증: 별도 작업 복사본의 build 전후 사용 웹 asset hash·서비스 실행 경로·DB 대상이 그대로인지 확인하는 작은 전체 흐름부터 검증한다.
- 테스트: 기존 TDD, typecheck·관련 unit·임시 SQLite API integration과 전체 line coverage 80%를 유지한다. 공유 사용 dist에서는 build·verify:u1을 실행하지 않는다.
- 배포: 기존 데이터·계정·주소·키·백업을 보존한다. 고정 릴리스와 웹/API의 동일 버전 전환·복구를 구체화한 뒤 실제 전환은 별도로 승인받는다.
- 코드·문서: 기존 언어 관례와 도구를 유지하고, 한국어 문서·안정 ID·관련 운영 안내와 검증 근거를 함께 정리한다.

이 내용으로 개발·운영 방식 문서를 최종 정리해도 될까요?

- Looks correct
- Request changes

[Answer]: Looks correct
