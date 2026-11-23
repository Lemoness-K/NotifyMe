# 로컬 로그 조회

다음 명령은 배포된 Pi에서 로그 조회 권한이 있는 운영자가 실행한다. 조회 범위는 유닛과 작업 시간으로 한정한다. 배포 호스트의 기존 journald 보존·권한 정책을 사용한다.

```bash
journalctl -u notify-me.service -p err --since '24 hours ago' --no-pager
journalctl -u notify-me-observe.service --since '7 days ago' --no-pager
journalctl -u notify-me-backup.service -u notify-me-backup-retention.service --since '48 hours ago' --no-pager
```

보존 정리의 실패는 운영 기록에서 확인한다. 운영 권한·로그 범위는 로컬 계정과 파일 권한을 따른다. [U5 보안 설계](../../construction/u5-operations-and-recovery/nfr-design/security-design.md)

구조화 이벤트의 앱 JSON은 journal의 `MESSAGE` 필드에 들어간다. CLI에서 표준 오류로 내보낸 기록이 journal의 오류 우선순위와 항상 일치하는 것은 아니므로, 상태 진단에는 대상 유닛의 일반 조회도 사용한다. 로컬 관측 메시지만 출력하는 예시는 다음과 같다.

```bash
journalctl -u notify-me-observe.service --since '24 hours ago' -o cat --no-pager |
  jq -R 'fromjson? | select(.event == "LOCAL_OPERATIONS") | {kind,id,at,health,backup,incidents}'
```

`jq`는 JSON만 골라 읽기 위한 선택 도구다. 사용하지 않을 때는 journal에서 `LOCAL_OPERATIONS`, `BACKUP_FINISHED`, `BACKUP_RETENTION_FAILED`를 각각 찾는다. 운영 기록 공유 시 고정 상태 코드·UTC 시각·집계값을 중심으로 필요한 정보만 옮긴다. 인증 비밀·사용자 주소·일정 본문·정확한 위치를 수집하지 않는다. [U5 운영 절차](../../../../../../../deploy/u5/README.md)
