# U4 설치·동기화 모니터링

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| 인증 포함 sync·후보 p95 | 요청 유형·시간 | DS-014 부하에서 500ms | 대표 설치 상태 회복 지연 |
| FCM 대기·최고 경과 시간 | outbox 및 집계 로그 | 24시간 경계에서 만료, 발송 상한 도달 경고 | 신호 수락과 기기의 실제 알림을 구별 |
| 설치 정리·용량 대기 | 명령과 재조정 결과 | 초과 및 장기 대기 상태 구분 | 정보 유실과 OS 제약 진단 |

## Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| 구독 설정 오류 | 작업 실패 연속 및 공급자 구성 오류 | Warning | systemd journal |
| epoch 정리 실패 | 기존 기기 예약 제거 실패 | Warning | 설치 상태 및 로컬 진단 |
| 잘못된 인가 | 등록 또는 동기화 토큰 거절 | Info | 요청 ID 기반 사용자 오류 |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| 동기화 대표 지연 | p95 500ms | DS-014 대상 Pi |
| 발송 유효성 | 만료 신호 발송 0건 | 경계·시간 제어 테스트 |

## Logs & Tracing

요청 ID와 상태·시간·건수만 내보낸다. 토큰·원문·좌표는 기록하지 않는다. 발송은 내구 기록을 점유하고 수락·일시 실패·영구 실패·만료를 따로 기록한다. 점유 기한이 끝나면 외부 발송 중복을 허용하며 기기는 신호 ID와 revision으로 합친다. 다시 보낼 때 TTL은 최초 만료까지의 잔여 시간이다.
