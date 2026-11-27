# U5 로컬 운영과 복구

## 운영 준비

기존 `runtime.env`의 인증과 Caddy 설정을 유지한다. U5 서비스 예제와 백업·보존 정리·상태 확인 타이머를 사용한다. `operations.env.example`의 경로를 적용할 때 서비스의 `RequiresMountsFor`와 `ReadWritePaths`도 맞춘다. 운영 자료, 백업 사본, 최신 원장 증거는 서로 다른 디렉터리다. 최신 원장 증거는 운영 DB나 백업 볼륨과 다른 실제 파일시스템에 마운트한다. 지정 유닛에만 정확한 경로의 쓰기를 허용한다.

운영자는 해당 볼륨의 `notify-me-volume` 파일을 모드 0600으로 만들고 설정의 `NOTIFY_OPS_VOLUME_ID`와 같은 값을 기록한다. 키 파일 두 개에는 서로 다른 32바이트 임의 키를 각각 base64url(패딩 없음)로 보관하고 서비스 계정에만 읽기를 허용한다. 키는 백업 또는 권위 볼륨에 두지 않는다. 파일이나 올바른 마운트가 없으면 임의 로컬 디렉터리로 대체하지 않는다.

운영 전환 시 기존 서비스 중지 후 마이그레이션 상태를 점검하고, 서비스 계정과 운영 설정을 사용해 `npm run operations -- initialize`를 한 번 실행한다. 현재의 검증된 원장만 기준 원장으로 초기화할 수 있다. 중단된 초기화나 알 수 없는 최신점은 기존 파일을 지우거나 복사해 해결하지 않는다. 해당 증거를 대조한 뒤 복구 절차를 수행한다.

## 신규 설치의 모바일 최초 설정

1. 운영자만 접근할 수 있는 HTTPS Tailscale Serve 주소를 준비한다. Caddy와 API는 loopback에 두고 Funnel은 사용하지 않는다. Google OAuth 등록 주소, `runtime.env`의 `NOTIFY_ORIGIN` 및 실제 브라우저 주소가 같아야 한다. [모바일 접속 안내](../../docs/u1-local-run.md#tailscale로-모바일-웹-접속).
2. 서비스 계정의 보호된 상태·백업 디렉터리, 별도의 권위 볼륨과 키를 위 절에 따라 준비한다. 새 인스턴스의 `NOTIFY_DATABASE_PATH`는 상태 디렉터리 안의 아직 존재하지 않는 절대 `.sqlite` 경로여야 한다. `DATABASE_URL`도 같은 경로를 가리킨다. 운영 설정에 `NOTIFY_SETUP_INGRESS=tailnet-operator-only`를 추가한다.
3. 새 인스턴스의 설정을 로드한 서비스 계정으로 배포 키와 DB 경로를 확인하고, 서비스 시작 **전** 저장소의 빌드된 릴리스 디렉터리에서 `npm run operations -- prepare-new-installation`을 실행한다. 명령이 새 DB 생성·마이그레이션·설정 허용 기록을 준비한다. 기존 SQLite나 이전 운영 기록과 함께 실행하면 거부된다. 준비가 완료되면 새 서비스를 시작하고 폰으로 첫 계정을 확인한다.
4. 일반 업그레이드에는 기존 활성 DB와 설치 상태를 보존한다. 운영자가 의도한 재설정은 별도 승인 뒤 기존 DB를 남기고 새 상태·백업·권위 위치에서 위 절차를 실행한다. [격리 검증 및 재설정](../../docs/u1-local-run.md#격리-검증과-의도적인-재설정).

새 등록을 여는 조건은 명시적으로 준비한 운영 기록과 활성 SQLite 세대의 일치다. 상태 파일을 수정하거나 지워서 초기 등록을 다시 열지 않는다. 복원은 후보와 최초 등록 자격을 닫으며, 이전 빈 스냅샷을 복원해도 등록이 열리지 않는다.

## 상태와 백업

- `systemctl status notify-me.service` 및 `journalctl -u notify-me.service -u notify-me-observe.service`는 서비스와 구조화 기록을 확인한다.
- `npm run operations -- status`는 로컬 소켓의 헬스, 프로세스 RSS, 운영 볼륨의 여유 공간과 최근 백업 결과를 확인한다.
- `npm run operations -- backup`은 앱의 운영 소켓에 일일 백업 요청을 보낸다.
- `notify-me-backup-retention.timer`를 활성화해 매시 15분(UTC)에 만료 정리를 실행한다. 수동으로는 서비스 계정으로 `npm run operations -- prune-backups`를 실행한다. 정리는 앱과 권위 원장 저장소의 가용성과 무관하게 백업 키로 카탈로그를 인증하고, 생성 시각부터 30일이 경과한 등록 사본을 제거한다. 복원 선택은 30일 경계부터 차단되며, 물리 정리는 백업 볼륨에 접근 가능한 다음 실행에서 이뤄진다.
- 백업 생성·복구가 백업 파일을 사용하는 중이면 보존 정리가 잠금 경합으로 실패하고 systemd가 재시도한다. 카탈로그 인증 실패나 볼륨 접근 오류도 `journalctl -u notify-me-backup-retention.service`의 `BACKUP_RETENTION_FAILED` 항목으로 확인한다.
- `NOTIFY_OPS_WEEKLY`와 `NOTIFY_OPS_INCIDENTS`는 각각 1에서 활성화한다. 주간 집계는 지정 시간대, 장애 기록은 분 단위 호스트 확인 및 상태 전이를 이용한다.

운영 소켓은 모드 0600이고 기존 Caddy 공개 라우트에 연결하지 않는다. `deploy/u1/Caddyfile.example`의 API 프록시는 복구 차단 상태에서 연결할 수 없으며 내부 헬스 경로는 기존대로 차단한다.

## 격리 복구

운영자는 서비스·백업 타이머를 중지한 뒤 권위 볼륨과 원장 사본, 백업 키를 확인한다. 서비스 계정의 동일 설정으로 `npm run operations -- restore <snapshot-id>`를 실행한다. 보존 정리와 경합하면 `OPERATIONS_BUSY`로 종료하므로 정리 실행이 끝난 후 복구를 다시 시도한다. 합격하면 새 DB가 준비되며 다음 기동이 파일 증거를 확인하고 새 epoch와 함께 활성화한다. 처리 실패 시 기존 자료가 보존되고 서비스는 검증 상태가 필요하다. 선택한 오래된 원장의 끝을 신뢰해 최신점을 덮어쓰지 않는다.

실제 Raspberry Pi 부하, 외부 수신 채널 및 운영 자료의 전환은 해당 환경에서 별도로 검증한다.
