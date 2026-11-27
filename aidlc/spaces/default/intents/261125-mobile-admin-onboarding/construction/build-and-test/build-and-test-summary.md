# 모바일 최초 관리자 등록 빌드·테스트 요약

Raspberry Pi 5 ARM64에서 Node 24.21.0과 기존 npm 의존성으로 빌드했다. [구현 계획](../u1-mobile-admin-onboarding/code-generation/code-generation-plan.md), [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md), [구현 결과](../u1-mobile-admin-onboarding/code-generation/code-summary.md)를 기준으로 구축 결과와 회귀를 확인했다. 복구 테스트는 두 중단 시점 모두 SQLite 연결을 닫고 다시 열도록 보강했다. 새 설치 가이드는 U5 시스템 서비스의 계정과 환경 파일을 일치시켰다.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TS 빌드 | 구성의 typecheck, build 스크립트 | 종료 코드 0 | 0 | [실행 결과](./test-results.md) | Build and Test | Met |
| 라인 커버리지 | `vitest.config.ts`와 `docs/08-test-strategy.md` | 80% 이상 | 86.89% | [전체 Vitest](./test-results.md) | Build and Test | Met |
| FR11.1–FR11.4, NFR11, NFR13 | 요구사항 분석 | 취소·동시 등록·멱등성과 후보 권한 검증 | SQLite/API 및 Chromium에서 통과 | [실행 결과](./test-results.md) | Build and Test | Met |
| FR11.5 | 요구사항 분석 | 기존 DB 로그인·초대 유지 | 기존 HTTP·SQLite 및 Chromium에서 통과 | [실행 결과](./test-results.md) | Build and Test | Met |
| FR11.6, NFR12 | 요구사항 분석 | 최초 설정·재설정 가이드와 DB 이상·복원·종료 차단 | 가이드 경로 확인, 임시 SQLite 통합 복원·재기동 통과 | [실행 결과](./test-results.md) | Build and Test | Met |
| NFR14 | 요구사항 분석 | Android Chrome·모바일 데이터·Tailscale·실제 Google 계정으로 저장 | Pi의 합성 검증만 실행, 실기기 미실행 | [추적 결과](./cross-unit-traceability.md) | Deployment Execution | Unverified |
| CI 구성 | 구현 계획의 테스트 계약 | 현재 계획의 CI 여부 확인 | 현재 계획에 CI Pipeline 단계 없음 | 승인된 작업 계획 | CI Pipeline | N/A |

Pi의 자동 검증을 통과했다. 실제 모바일 데이터 경로, Google OAuth와 테스트 인스턴스의 조합은 배포 단계 목표로 유지한다.
