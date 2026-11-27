# 모바일 최초 관리자 등록 빌드 절차

실행 환경은 Raspberry Pi 5 ARM64의 Node 24.21.0과 기존 npm 의존성이다. 새 체크아웃의 의존성은 저장소 루트에서 `npm ci`로 설치한다. TypeScript·Prisma·Vite와 브라우저 환경은 [구현 계획](../u1-mobile-admin-onboarding/code-generation/code-generation-plan.md), [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md), [구현 결과](../u1-mobile-admin-onboarding/code-generation/code-summary.md)를 따른다.

```bash
npm run typecheck
npm run build
```

Pi 검증에는 이 저장소에 준비된 Chromium·글꼴·공유 라이브러리를 사용한다. 전체 검증 명령은 [승인된 검증 명령](../../verification-command.txt)에 있다. 이전 Caddy 준비 테스트의 일시 지연에 대응해 Pi에서는 Vitest 작업자를 2개로 제한한다. 전체 라인 80% 기준과 기존 검사 설정은 유지한다. 운영 DB·운영 Firebase·실제 서비스에는 연결하지 않는다.
