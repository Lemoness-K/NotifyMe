# U5 logical-components

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR7.4.5. 명령은 입력과 결과를 공통 상태 코드로 표현한다. 데이터·암호화·원장 증거는 운영 표시 포맷과 분리한다.
- NFR8.2.5. 기존 Node.js 24·Prisma SQLite 및 배포 아키텍처를 사용한다. 능동 백업은 현재 SQLite 어댑터가 지원하는 온라인 스냅샷 API로 연결하며 ARM64에서 실제 생성·복원으로 시험한다.
- NFR9.1.5~NFR9.3.5. 기존 원장 및 서비스에 격리된 운영 경계를 추가한다. 실패 테스트를 먼저 작성하고, 합성 사본 실제 리허설와 기존 TypeScript 검사·빌드·라인 80%·Playwright를 실행한다.
