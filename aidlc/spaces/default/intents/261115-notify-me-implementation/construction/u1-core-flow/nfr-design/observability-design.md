# U1 관측·검증 설계

## Sources

U1의 `functional-spec.md`, `contract-summary.md`, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`를 기준으로 한다.

## Signals and operational boundaries

각 요청에 서버가 발급한 요청 ID를 두고 응답의 안전한 오류 코드, 서버의 처리 결과·분류·응답 시간 로그에 연결한다. 경로는 원문 URL 대신 라우트 이름으로 표현한다. 인증 토큰·세션 쿠키·사용자 제목과 설명·위치 원문·운영 자격 증명을 기록하지 않는다. 공개 경로에서 로컬 헬스나 설정을 노출하지 않는다.

| 신호 | 사용처 |
| --- | --- |
| 요청 성공·오류 유형과 지연 | 대표 경로 p95, 인증 장애와 잘못된 자격 증명의 차이 확인 |
| 저장 충돌·실패·재시작 결과 | 데이터 저장 문제와 재시도 증가 확인 |
| 로컬 프로세스 상태 | 운영자 점검과 후속 systemd 실행 구성 연결 |

별도의 외부 추적 서비스 없이 요청 ID로 시작한다. 실제 운영 알림의 임계와 수신 경로는 U5에서 승인된 운영 정책으로 결정한다.

## CI evidence

U1 Code Generation 계획에는 담당 개발자가 저장소 내 최소 CI 검증 작업을 구성하고 산출물의 식별자와 커밋에 결과를 연결하도록 명시한다. 타입 검사, 승인된 단위·통합·종단 확인, 전체 라인 커버리지 80% 기준의 결과를 구분한다. 로컬 인증은 합성 데이터로 검증한다. 승인된 비운영 환경의 실제 연동과 대상 기기 결과는 별도 증거로 기록한다. CI가 생기기 전에는 검증 증거가 대기 상태다.
