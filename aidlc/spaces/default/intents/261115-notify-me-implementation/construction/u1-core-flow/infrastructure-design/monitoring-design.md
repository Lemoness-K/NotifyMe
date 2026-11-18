# U1 모니터링 설계

## Sources

U1 `performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, 도메인 `components.md`, `functional-spec.md`, `contract-summary.md`와 기존 Raspberry Pi 운영 설계를 근거로 한다.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| 주요 화면 응답 p95 | 라우트별 요청 시간 | 대상 DS-014 조건에서 500ms 이하 | 목표 장치에서 사용 가능할 응답 시간 |
| 메모리와 저장장치 쓰기량 | 대상 호스트 관측 | DS-014에서 정할 예산과 비교 | 제한된 Pi 자원과 저장장치 확인 |
| 인증 결과·공급자 장애·쓰기 실패 | 라우트 결과와 구조화 로그 | U1 시험에서 기대 코드와 데이터 보호 충족 | 사용자 인증 오류와 일시 장애를 구분 |
| 프로세스 상태·재시작 후 재조회 | systemd 상태와 로컬 상태 조회, 통합 결과 | 승인된 시나리오에서 일관 데이터 | 재시작으로 데이터를 잃지 않는지 확인 |

## Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| 사용자 요청 처리 이상 | 인증 공급자 일시 장애 또는 지속 저장 실패를 운영자가 확인 | 운영 분류와 임계는 U5에서 확정 | U1은 로컬 상태와 로그를 제공하고 U5에서 운영 알림 연결을 정한다. |
| 용량·응답 목표 이탈 | 승인된 부하에서 Pi 기준을 넘김 | 검증 실패로 기록 | 개발 담당과 검토 기록 |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| 대표 화면 요청의 p95 | 500ms 이하 | DS-014 승인 시험 구간 |
| 반복 등록의 데이터 일치 | 같은 요청이 하나의 업무와 회차로 수렴 | U1 통합 검증의 동시 요청·재시작 시나리오 |
| 가용성 | 운영 SLO 수치 제안 없음 | 운영 검증 범위에서 측정 조건 명시 |

## Logs & Tracing

서버 발급 요청 ID, 허용된 분류 코드, 라우트 이름, 지연, 결과를 남긴다. 토큰, 세션 비밀, 사용자 입력 원문은 제외한다. 대상 환경에서는 stdout·stderr를 journald에서 로컬로 검색한다. 사용자 요청과 오류는 요청 ID로 연결하고, 공개 Caddy 경로에서 운영 상태를 제공하지 않는다. 별도 대시보드 없이 기존 로컬 진단을 사용한다.
