# U3 인프라 명세

## Sources

- `performance-design.md`와 `scalability-design.md`의 단일 노드 조회·반복 작업 크기를 Deployment에 연결한다.
- `security-design.md`와 `reliability-design.md`의 독립 보존과 복구 조정을 Infrastructure Services 및 Delete Journal and Backup Boundary에 연결한다.
- `observability-design.md`는 `monitoring-design.md`의 지표·로그 기준이고 `logical-components.md`는 CI와 Application Boundaries의 검증 기준이다.
- 도메인 `components.md`, `functional-spec.md` 및 `contract-summary.md`의 데이터 소유권·포트를 Shared Infrastructure에 반영한다.

## Deployment

| Facet | Choice | Rationale |
| --- | --- | --- |
| Compute | Raspberry Pi ARM64의 기존 systemd Node.js 24 서비스 | 단일 writer와 SQLite 트랜잭션을 같은 프로세스에서 조정한다. |
| Network | 기존 Caddy HTTPS 및 loopback API | 독립 원장과 진단은 공개 라우팅에서 제외한다. |
| Storage | 운영 DB와 독립 원장의 경로 및 수명 주기를 분리한다. 서비스 계정만 쓰고 검증된 복구 운영자만 읽는다. | DB 복원과 롤백이 외부 원장을 되돌리지 않도록 한다. 원장을 DB 백업과 함께 교체하거나 회전하지 않는다. |
| Environments | 개발·CI는 격리된 임시 DB와 원장을 쓴다. ARM64 runner 및 대상 Pi는 별도 검증 기록을 가진다. | 각 환경의 권한과 native 모듈 조건을 구별한다. |
| IaC | 기존 `deploy/u1` Caddy 및 systemd 예제에 필요한 경로와 권한을 연결한다. | 운영 방식과 비용을 유지한다. |
| Resource sizing | 반복 작업 한 묶음 100개 이하, 문서화한 페이지 기본 25·최대 100 | DS-014에서 대상 Pi의 RSS, 저장 쓰기량, 조회 지연을 측정한다. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
| --- | --- | --- | --- |
| SQLite | 운영 DB | Prisma와 better-sqlite3, 업무·회차·검증·피드·커밋 증거의 트랜잭션 | NFR3.1.3, NFR3.2.3, NFR5.1.3, NFR5.2.3, NFR5.3.3 및 NFR8.2.3 |
| 독립 저널 | 영구 삭제 복구 증거 | 같은 작업 ID로 REQUESTED와 COMMITTED를 연결하는 단일 writer, 증가 순번과 내구 확인 | NFR3.4.3 및 NFR2.3.3 |
| Caddy | HTTPS ingress | 기존 공개 URL 및 U1 세션 경계 | NFR1.1.4 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
| --- | --- | --- | --- |
| 가구·구성원과 locale | U2 | U3 | 현재 소속과 가구 ID로 CRUD 및 검증 전이를 제한한다. NFR1.2.3, NFR1.3.3 및 NFR7.1.3~NFR7.5.3 |
| 계획 참여 포트 | U3 | U4 | 계획 후보 검증을 DB 저장 안에 포함한다. 설치와 OS 처리는 커밋 이후 U4가 맡는다. NFR3.3.3 |
| 복구 삭제 원장 | U3 | U5 | 새 삭제를 막는 독점 핸들이 닫힌 동안 정확히 일치하는 기존 REQUESTED만 종결할 수 있다. |

## Delete Journal and Backup Boundary

1. U5 호출자가 스냅샷 진입 전에 독점 핸들을 얻는다. 이후 새 삭제는 새 원장 행을 쓰지 않은 상태에서 제한된 재시도 결과를 반환한다. 기존 요청의 재시도는 작업 ID·범위·본문이 이미 기록된 요청과 일치할 때만 종결 경로에 들어간다.
2. U5는 진입했던 삭제가 내구 종결되고 증거와 같은 스냅샷에 반영됐는지 점검한다. 증거 확인이나 사본 생성이 실패하거나 제한 시간을 넘으면 기준점을 발행하지 않는다. 성공·실패·시간 초과에서 핸들을 정리한다. 격리 복원에 성공 증거가 없다면 인스턴스를 서비스에서 격리하고 종료 시에도 격리를 유지한다.
3. 미확정 요청의 연결 증거는 내구 종결 전까지 유지한다. 피드의 tombstone, 독립 저널, 암호화 백업, 운영 DB 증거와 업무 감사 이력은 목적과 만료 조건을 각각 가진다. 원장 및 사본의 30일 상한을 준수하면서 필요한 구간을 입증할 수 없으면 기준점 발행과 복원 공개를 거부한다. 감사에도 제목·좌표 등 삭제 원문을 남기지 않는다. NFR2.1.3.

## Application Boundaries

- 회차 시간 계산과 DST 검증은 앱에서 담당한다. NFR4.1.3 및 NFR4.2.3.
- 검증 대기만 있는 업무 그룹의 서버 정렬은 가장 이른 OPEN 요청 시각과 해당 회차 ID를 사용한다. 같은 요청 키가 필요한 경우 목록은 업무 ID를 최종 정렬 키로 사용한다. 검증 대기 회차 필터에서 요청 시각과 회차 ID를 커서에 기록하고 사용자·가구·업무·필터에 묶는다. U3 응답은 현재 호출자의 actions와 독립 대기 건수를 항상 보낸다. NFR7.4.3 및 NFR8.1.3.
