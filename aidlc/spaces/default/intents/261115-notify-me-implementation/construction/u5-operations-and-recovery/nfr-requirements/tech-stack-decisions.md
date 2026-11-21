# U5 tech-stack-decisions

## Sources

`functional-spec.md`와 `rules.md`, `requirements.md`, `contract-summary.md`, `technology-stack.md`를 따른다.

## Requirements

- NFR7.4.5. 운영 프로세스의 결과·상태는 구조화 코드와 값으로 반환한다. locale에 따라 원장과 인증 증거가 바뀌지 않는다.
- NFR8.2.5. Node.js 24·SQLite adapter의 ARM64 호환성을 합성 SQLite로 확인한다. 실제 Pi의 부팅과 재시작 증거를 별도 기록한다.
- NFR9.1.5. 삭제 실패·원장 연속성·복원 차단을 구현 전에 실패 테스트로 재현한다.
- NFR9.2.5. 합성 사본 실제 복원과 기존 전체 앱 검증을 자동 실행하고 CI와 대상 운영 검증 결과를 구분한다.
- NFR9.3.5. 전체 TypeScript 라인 80%와 기존 회귀를 유지한다.
