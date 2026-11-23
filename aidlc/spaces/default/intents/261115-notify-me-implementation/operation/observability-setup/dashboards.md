# 운영 상태 조회

D-077의 Raspberry Pi 운영 화면은 호스트 명령으로 구성한다. 운영 권한이 있는 계정에서 배포 지침에 따라 조회한다. 별도 웹 대시보드는 MVP 범위 밖이다.

| 확인할 항목 | 조회 | 확인할 값 |
| --- | --- | --- |
| 프로세스와 최근 재시작 | `systemctl status notify-me.service` | 활성 상태, 재시작과 종료 원인 |
| 로컬 API·SQLite | 배포 설정을 읽도록 구성한 서비스 계정에서 `npm run operations -- status` | `READY` 또는 장애 상태 |
| 자원 | 같은 상태 명령 | `rss`와 운영 볼륨 `freeBytes`. 보호 상태를 읽지 못하면 값이 없을 수 있다. |
| 백업 | 같은 상태 명령과 백업 유닛의 로그 | 최근 `RUNNING`, `SUCCEEDED`, `FAILED`와 타이머 실행 상태 |
| 타이머 | `systemctl list-timers 'notify-me-*'` | 관측·백업·보존 정리의 최근/다음 실행 |
| 앱 및 작업 오류 | [로그 명령](log-queries.md) | 유닛 실패, 상태 코드, 실행 시각 |

`status`는 로컬 Unix 소켓만 사용한다. 소켓 권한은 0600이며 공개 Caddy 경로에서 접근을 차단한다. `freeBytes`는 운영 볼륨의 현재 여유 공간이며 저장장치 쓰기 증가량의 측정값은 아니다.

복구 중에는 검증된 DB 세대가 활성화될 때까지 readiness가 차단된다. 공개 서비스의 준비 상태와 단순 프로세스 실행 상태를 분리해 점검한다. [U5 인프라 명세](../../construction/u5-operations-and-recovery/infrastructure-design/infrastructure-specification.md) · [U5 신뢰성 설계](../../construction/u5-operations-and-recovery/nfr-design/reliability-design.md)

## 검증

`npm exec -- vitest run tests/u5/runtime.test.ts`에서 8개가 통과했다. 로컬 소켓 응답, 공개 Caddy 헬스 차단, 보고 기능의 독립 활성화와 장애 전이를 포함한다. `systemd-analyze calendar`로 관측·백업·보존 정리의 스케줄을 해석했다. 실제 Pi에서는 유닛 설치·기동과 조회 결과를 별도 기록한다. [U5 관측 설계](../../construction/u5-operations-and-recovery/infrastructure-design/monitoring-design.md)
