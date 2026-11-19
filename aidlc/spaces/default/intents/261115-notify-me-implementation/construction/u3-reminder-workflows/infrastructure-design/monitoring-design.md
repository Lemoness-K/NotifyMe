# U3 모니터링 설계

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| 인증 포함 대표 읽기 p95 | 요청 ID·고정 경로 코드·처리 시간 | 500ms 목표, DS-014에서 표본과 부하 확정 | 실제 Android와 웹이 공유하는 API의 응답 지연 |
| 반복 작업과 SQLite 경합 | 실행 ID·처리 건수·재시도 수 | 상한 도달 또는 실패 시 이벤트 | 밀린 회차 및 일시 쓰기 경쟁 확인 |
| 미확정 삭제 수·최고 경과 시간 | 원장 최신 내구 상태와 불투명 작업 ID | 새 미확정 발생 즉시 경고, 경과 시간 알림 기준은 U5 | 백업 공개를 막는 증거 불일치 확인 |

## Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| 삭제 원장 경고 | DB와 원장 확정 사이의 실패, 디스크 오류, 증거 누락 | Warning | systemd journal과 로컬 운영 확인 |
| 서비스 시작 실패 | native SQLite 로드·마이그레이션·DB 경로 또는 원장 접근 실패 | Error | systemd 상태와 로컬 readiness 점검 |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| 대표 가구 조회 시간 | p95 500ms | Pi 환경의 DS-014 검증 창 |
| 공개한 백업 기준점 증거 일치 | 100% | 기준점 발행 시마다 U5가 검증 |

## Logs & Tracing

NFR10.1.3 및 NFR10.2.3. 기존 구조화 로그를 journald로 수집한다. 경로 코드는 제한된 집합을 쓰고, 불투명 요청 ID·동작·전이·지연·실패 유형을 연결한다. 콘텐츠·정확한 좌표·자격 증명은 제외한다. 로컬 운영 확인은 최신 상태를 집계해 재시도로 인한 중복을 제거한다.
