# U5 cicd-pipeline

## Sources

`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `components.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Build and Test

- NFR8.2.5, NFR9.1.5, NFR9.2.5, NFR9.3.5. 현재 Node 24 CI와 ARM64에서 실제 합성 SQLite 백업·복호화·복원을 실행한다. R-05와 R-06에 해당하는 소속 회수·설치 정리 실패, 인증 기준점 경쟁, 원본 호스트 유실과 stale 사본, 30일 정리, 복원 전후 재시작을 각각 실패 시나리오로 검증한다. 전체 TypeScript 라인 80%와 U1~U4 회귀를 유지한다.
- 기존 systemd·Caddy 예제로 서비스 재시작, 로컬 운영 명령 차단, 타이머와 롤백을 검증한다. 실제 Pi 배포·실제 자격·공개 네트워크 변경은 별도 운영 승인이다.

## Promotion and Rollback

작동 자료가 없는 테스트 경로에서 검증한 다음, 승인된 결과만 기존 git 절차로 반영한다. 원본 DB와 이전 버전은 보존한다. 스키마 전환이나 복구 실패 후 예전 버전이 검증 없이 자동 공개되지 않도록 한다.

## Secrets

CI는 합성 데이터와 테스트용 키만 사용한다. 운영 키와 독립 최신 증거 파일은 GitHub 아티팩트, Issue, 빌드 번들에 포함하지 않는다.
