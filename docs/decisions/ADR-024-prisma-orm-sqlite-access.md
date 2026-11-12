# ADR-024: SQLite 접근 도구로 Prisma ORM 7 사용

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-053`, `D-055`, `D-056`
- 해결한 질문: `Q-037`
- 관련 요구사항: `F-OPS-001`, `F-OPS-005`, `PR-AC-044`, `NFR-REL-003`, `NFR-PERF-002`, `NFR-PERF-003`
- 관련 문서: [도메인·데이터 설계](../02-domain-and-data-design.md), [시스템 아키텍처](../03-system-architecture.md), [배포·운영](../06-deployment-and-operations.md)

## 맥락

MVP 데이터베이스는 Raspberry Pi 로컬 파일 기반 SQLite다(`D-053`). 서버 API framework는
NestJS로 정했다(`D-055`). 서버 코드는 SQLite 스키마를 버전 관리하고, 타입 오류를 줄이며,
업무 변경과 감사·동기화 outbox를 원자적으로 저장해야 한다.

NestJS 공식 Prisma 가이드는 Prisma ORM 7, SQLite용 `@prisma/adapter-better-sqlite3`,
schema 기반 Prisma Client, 사용자 검토가 가능한 SQL migration을 안내한다. 가이드는 당시
npm `latest` tag가 Prisma ORM 8 prerelease를 가리킬 수 있으므로 맞는 major version을
명시하라고 주의한다([NestJS Prisma + SQLite 가이드](https://docs.nestjs.com/data/prisma)).

## 결정

- SQLite ORM/query layer는 **Prisma ORM 7**로 한다(`D-056`).
- Prisma schema와 migration 파일은 버전 관리하고, 배포 시 순서대로 migration을 적용한다.
- NestJS는 생성된 Prisma Client를 application provider로 주입해 사용한다. Prisma·SQLite 타입은 domain entity와 business rule에 노출하지 않는다.
- SQLite driver는 NestJS 공식 가이드에 맞춘 `@prisma/adapter-better-sqlite3`를 사용한다.
- `prisma`, `@prisma/client`, adapter의 호환되는 Prisma 7 버전을 함께 고정하고 lockfile을 커밋한다. floating `latest` tag로 버전을 자동 이동시키지 않는다.
- migration SQL은 검토 가능한 파일로 유지한다. Prisma schema가 직접 표현하지 못하는 SQLite 제약은 migration SQL에 명시한다.
- `D-053`의 SQLite 운영 조건(WAL, 모든 연결의 foreign key, 짧은 write transaction, 단일 Worker, 일관된 online backup)은 Prisma 선택 뒤에도 그대로 적용한다. 초기화 시 driver connection마다 필요한 pragma가 적용되는지 구현 단계에서 확인한다.
- 실제 RPi의 Node.js 버전, ARM64 driver 설치·실행, cold start, migration 적용은 구현 단계에서 검증한다. 별도 데이터베이스 server는 도입하지 않는다.

## 결과

### 장점

- 선언형 schema와 생성된 TypeScript client를 사용해 모델과 일반 CRUD를 다루기 쉽다.
- migration SQL을 검토하고 필요한 SQLite 전용 SQL을 보완할 수 있다.
- NestJS official SQLite integration 절차와 같은 구조를 사용할 수 있다.

### 고려할 점

- ORM 없이 직접 SQL을 쓰는 것보다 생성 단계와 driver adapter 설정이 추가된다.
- SQLite pragmas, 복합 제약, 단기 트랜잭션, ARM64 driver 호환성을 실제 배포 구성에서 확인해야 한다.
- PostgreSQL로 옮기더라도 migration과 데이터 변환을 별도로 계획한다. 같은 Prisma schema를 사용한다는 이유로 자동 전환이 보장된다고 간주하지 않는다(`D-053`).

## 고려한 대안

- **Drizzle**: SQL에 가까운 TypeScript query builder이며 NestJS 통합도 있다. SQLite SQL을 더 직접 다루는 장점이 있지만, CRUD와 관계 모델을 익히는 첫 프로젝트에서는 Prisma의 schema-generated client와 공식 NestJS SQLite 절차를 우선했다([NestJS database integrations](https://docs.nestjs.com/data/overview), [Drizzle migrations](https://orm.drizzle.team/docs/migrations)).
- **TypeORM**: NestJS가 공식 통합 패키지를 유지하고 migration을 제공한다. entity decorator와 repository pattern이 가능하지만, 도메인 model과 저장 mapping의 독립성을 유지하기 위해 MVP 선택으로 두지 않았다([NestJS TypeORM](https://docs.nestjs.com/data/typeorm)).
- **직접 SQL**: 가장 명시적인 SQL 제어를 제공하지만, CRUD와 결과 타입을 매번 수작업으로 구성해야 해서 초기에 선택하지 않았다.

## 재검토 조건

실제 RPi ARM64 환경의 driver 호환성·메모리 사용·배포 복잡도에 문제가 있거나, 향후 동시성·DB 전환 요구가 달라지면 ORM/query layer를 재검토한다. 성능은 측정된 필요가 생길 때 비교한다.
