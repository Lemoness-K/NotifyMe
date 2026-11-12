# ADR-021: MVP 데이터베이스로 SQLite 사용

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-025`, `D-053`, `D-056`
- 관련 요구사항: `PR-AC-031`, `PR-AC-044`, `NFR-REL-007`

## 맥락

MVP는 단일 Raspberry Pi의 한 household를 위한 저동시성 서비스다. 외부 DB server를 별도로 운영하지
않고 시작하고 싶지만, 이후 household 수, 쓰기 동시성 또는 server 인스턴스가 늘어날 가능성은 열어 둬야
한다. 업무 변경과 Occurrence·history·outbox는 원자적으로 저장되어야 한다.

## 결정

- MVP 관계형 저장소는 SQLite 파일 하나를 사용하고, RPi의 코드 외부 로컬 영속 디렉터리에 저장한다.
- DB 파일은 NFS 등 네트워크 파일시스템에 두지 않는다. 실제 경로·백업·복구 운영은 `docs/06-deployment-and-operations.md`를 따른다.
- SQLite 외래 키 검증을 각 DB connection에서 명시적으로 활성화한다. WAL은 local persistent filesystem에서 동시 reader 동작을 위해 사용하며, 단일 writer 제한은 계속 적용한다.
- MVP Worker는 한 인스턴스만 실행한다. 쓰기 transaction은 짧게 하고 transaction 안에서 네트워크 호출, 사용자 대기, provider 응답 대기를 하지 않는다. 일시적인 writer lock은 제한된 재시도와 idempotency로 처리한다.
- 각 schema 변경을 순서 있는 versioned migration으로 관리한다. DB 접근은 repository 경계에 두고, SQLite 전용 동작이 도메인 규칙으로 새어 나오지 않게 한다.
- 운영 중 백업은 SQLite Online Backup API 또는 동등하게 일관된 snapshot 방식을 사용하고, 실제 복원 절차를 검증한다.
- 상용화 전 또는 다중 worker·server instance·높은 동시 쓰기 요구가 구체화되면 SQLite 지속 여부를 재평가한다. PostgreSQL은 후보 전환 대상으로 두되, SQLite에서 자동 호환된다고 가정하지 않고 별도 data migration과 복원 검증을 계획한다.

## 결과

- MVP에서 별도 DB service의 설치·계정·포트·업데이트 운영 부담을 줄인다.
- SQLite는 한 번에 하나의 writer만 허용하므로 동시 쓰기는 직렬화된다. WAL은 reader와 writer의 동시 동작을 도울 뿐 다중 writer를 제공하지 않는다.
- 단일 Worker와 짧은 transaction으로 MVP workload를 유지하고, busy/locked 상황의 명시적 재시도 및 로그가 필요하다.
- PostgreSQL 전환 비용을 완전히 없애는 것은 아니다. SQL, migration, transaction/lease 동작, 인덱스와 백업을 대상 DB에서 다시 검증한다.

## 공식 근거

- [SQLite: Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html): 저동시성·단일 서버 사용에 대한 범위와 한 번에 하나의 writer 제한을 설명한다.
- [SQLite: Write-Ahead Logging](https://www.sqlite.org/wal.html): WAL의 reader/writer 동작과 단일 writer 제한을 설명한다.
- [SQLite: Foreign Key Support](https://www.sqlite.org/foreignkeys.html): foreign key enforcement는 각 connection에서 활성화해야 한다.
- [SQLite Online Backup API](https://www.sqlite.org/backup.html): 사용 중인 DB의 일관된 백업 snapshot을 만드는 API를 설명한다.
- [PostgreSQL: Supported Platforms](https://www.postgresql.org/docs/current/supported-platforms.html): Linux 및 ARM 계열 지원을 확인할 수 있다.
