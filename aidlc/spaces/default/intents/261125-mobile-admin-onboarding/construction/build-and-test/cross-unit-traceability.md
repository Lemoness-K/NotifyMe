# 구현 범위 추적 확인

`aidlc engine sensor-traceability --stage build-and-test` 결과는 10개 중 U1 구현·정적 검증 연결 9개, 미검증 1개다. 입력은 [구현 계획](../u1-mobile-admin-onboarding/code-generation/code-generation-plan.md), [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md), [구현 결과](../u1-mobile-admin-onboarding/code-generation/code-summary.md)다.

| ID | 소유 | 연결 |
|---|---|---|
| FR11.1 | U1 | `src/server/admin-onboarding.ts` |
| FR11.2 | U1 | `src/web/App.tsx` |
| FR11.3 | U1 | `src/server/admin-onboarding.ts` |
| FR11.4 | U1 | `tests/u1/mobile-admin-onboarding.test.ts` |
| FR11.5 | U1 | `tests/u2/http.test.ts` |
| FR11.6 | U1 | `docs/u1-local-run.md` |
| NFR11 | U1 | `tests/u1/mobile-admin-onboarding.test.ts` |
| NFR12 | U1 | `tests/u5/mobile-admin-onboarding-operations.test.ts` |
| NFR13 | U1 | `src/server/http.ts` |
| NFR14 | Deployment Execution | 실기기 검증 미수행. `docs/u1-local-run.md`가 실행 절차를 제공한다. |

NFR14는 실제 Google 로그인과 물리 기기의 모바일 데이터 경로를 요구한다. Pi의 Chromium 및 합성 인증 경로를 이 요구사항의 완료로 계산하지 않는다.
