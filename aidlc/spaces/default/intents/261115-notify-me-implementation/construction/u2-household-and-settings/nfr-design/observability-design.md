# U2 관측 설계

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

- 요청 로그는 기존 요청 ID, 라우트 패턴, 결과 코드, 상태, 처리 시간만 사용한다. 만료 정리는 실행 ID·삭제 건수·소요 시간·실패 유형과 만료된 이메일 최대 지연 시간을 남긴다. 서버·프록시 로그에 초대 코드, 대상 이메일, 자격 증명, 상세 사용자 입력은 넣지 않는다.
- 정리 실행 실패는 즉시 로컬 로그에 기록한다. 두 실행 간격인 10분을 넘어 밀린 이메일이 있으면 지연 경고를 기록하고 원인을 진단한다. 임시 장애 뒤 정리가 상태를 문제없이 회복하는지 검증한다. 외부 보고·경보 채널은 U5 운영 설계가 맡는다.
- 대표 지표는 인증 401, 권한 403, 동시 충돌 409, 제한 429, 저장·공급자 503, 만료 정리 지연, 대표 요청 p95다. 상태 확인은 기존 로컬 경로로 제한한다.
