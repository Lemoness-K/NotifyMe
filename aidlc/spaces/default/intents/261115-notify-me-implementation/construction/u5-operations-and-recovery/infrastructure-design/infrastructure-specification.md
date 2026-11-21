# U5 infrastructure-specification

## Sources

`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `components.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Shared Infrastructure

- 기존 Raspberry Pi, 단일 systemd API/Worker, Caddy와 로컬 SQLite를 사용한다. 영속 운영 자료, root만 쓰는 설정, 암호화 키, 복구 사본, 권위 있는 원장 증거의 실제 경로는 별개로 설정한다.
- NFR1.1.5, NFR1.2.5, NFR1.3.5, NFR5.3.5. 운영 상태·백업은 호스트 전용 명령과 접근 제한 로컬 소켓을 사용한다. 백업 요청은 실행 중인 단일 쓰기 소유자에서 실행하고, 복원은 서비스 차단과 배타적인 직접 쓰기를 사용한다. 소켓을 HTTP ingress에 연결하지 않는다.
- NFR1.4.5, NFR2.1.5, NFR2.3.5. 키는 백업 사본과 분리된 운영 자격 파일을 사용하고 모드 0600을 적용한다. 복호화한 임시 파일은 0700 격리 작업 디렉터리에 0600으로 생성한다. 태그 확인 전 SQLite로 열지 않고 실패·중단 시 임시 자료를 정리한다. 카탈로그가 만료된 물리 사본의 정리 실패를 기록한다.
- NFR3.1.5, NFR3.2.5. 운영자가 권위 있는 증거 저장 위치와 계보를 구성한다. 원장 사본 디렉터리와 분리하고 원본 호스트 유실 뒤에도 발견 가능한 독립 저장 매체를 쓴다. 구성한 최신 권위 위치의 누락이나 신뢰 실패 때 복구를 차단한다. 백업은 삭제 경계에서 cutoff·누적 인증값을 사본에 묶고, 암호화 후 카탈로그 발행 직전에 같은 락을 다시 취득해 proofFloor와 검증한 cutoff의 이력을 확인한다. 그사이에 증거가 이동해 사용할 수 없으면 사본을 발행하지 않는다. 원장 정리 시 바닥 위치의 인증값을 보존하며 백업 기준점의 인증값과 그 뒤의 행을 대조한다.
- NFR3.3.5, NFR3.4.5. 시작 명령과 readiness가 같은 내구 활성화 기록을 확인한다. 복구 중에는 차단 레코드를 유지하며 검증한 활성 DB 경로·epoch를 한 번에 전환한다. 기존 사이트 공개는 이 검사에 종속된다. 점검용 실행은 발송 Worker를 기동하지 않는다.
