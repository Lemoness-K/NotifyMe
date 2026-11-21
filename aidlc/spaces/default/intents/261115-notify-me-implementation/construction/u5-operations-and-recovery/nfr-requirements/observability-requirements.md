# U5 observability-requirements

## Sources

`functional-spec.md`와 `rules.md`, `requirements.md`, `contract-summary.md`, `technology-stack.md`를 따른다.

## Requirements

- NFR10.1.5. systemd 상태, 로컬 헬스, 디스크·RSS, 최근 백업·복구 결과, 주간 보고와 감지 즉시 장애 기록을 호스트에서 확인한다. 선택 기능이 꺼진 상태와 운영 과정 실패를 구분한다.
- NFR10.2.5. 공개 Caddy 경로에서 내부 헬스·운영 명령에 접근할 수 없음을 검사한다. 비밀값과 업무 본문은 운영 로그 및 백업 결과 요약에 없어야 한다.
