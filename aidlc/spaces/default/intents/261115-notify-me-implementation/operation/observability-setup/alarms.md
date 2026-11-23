# 장애 기록과 운영 대응

D-092와 D-098에 따라 선택 기능은 `NOTIFY_OPS_WEEKLY=0`과 `NOTIFY_OPS_INCIDENTS=0`이 초기값이다. 운영 승인 후 각각 독립적으로 켤 수 있다. 관측 타이머가 켜져 있으면 매 분 로컬 상태를 확인한다. 장애 이벤트는 최초 감지 시 로컬 기록에 남으며 타이머 간격과 실행 가능 여부에 영향을 받는다.

| 신호 | 기존 기록 | 운영자 확인 |
| --- | --- | --- |
| 로컬 헬스가 `UNAVAILABLE`로 전이 | 장애 기능 활성 시 `LOCAL_OPERATIONS / INCIDENT` | 서비스 상태, 마운트, 소켓 권한과 최근 실패 기록을 확인 |
| 로컬 검사 오류 `CHECK_FAILED` | 장애 기능 활성 시 각 확인 실패의 `LOCAL_OPERATIONS / CHECK_FAILED` | 미확인 상태와 서비스 장애를 분리하고 소켓·타이머 로그를 대조 |
| 장애 후 `READY` 복귀 | 장애 기능 활성 시 `LOCAL_OPERATIONS / RECOVERED` | 서비스와 DB 상태 재확인 |
| 백업·정리 실패 | `BACKUP_FINISHED`의 `FAILED` 또는 `BACKUP_RETENTION_FAILED`와 유닛 실패 상태 | 백업 볼륨, 인증된 카탈로그, 잠금 경합 확인. 기존 백업 자료를 보존 |
| 주간 요약 | 요약 기능 활성 시 `LOCAL_OPERATIONS / WEEKLY` | 설정한 운영 시간대의 주간 기록, 장애 전이 수와 최근 백업 상태 확인 |
| 대표 API 지연·자원 | 운영 경보 임계값은 후속. 승인된 500ms 시험 목표는 성능 검증에서 사용 | [SLI와 시험 목표](slo-config.md) |

지속 장애는 매 분 새 `INCIDENT`를 만들지 않는다. 기록 중 프로세스가 중단되면 같은 이벤트 ID가 다시 나타날 수 있다. 호스트의 전원이나 OS가 정지한 동안에는 이 관측기도 동작하지 않는다. 외부 알림과 독립 감지는 후속이다. [U5 관측 설계](../../construction/u5-operations-and-recovery/infrastructure-design/monitoring-design.md)
