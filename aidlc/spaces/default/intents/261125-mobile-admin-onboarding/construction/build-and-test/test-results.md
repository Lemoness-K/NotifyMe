# 모바일 최초 관리자 등록 검증 결과

실행 대상은 Pi 5 ARM64의 로컬 checkout이다. 운영 인스턴스의 서비스, DB 및 인증 자격은 사용하지 않았다. [구현 계획](../u1-mobile-admin-onboarding/code-generation/code-generation-plan.md), [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md), [구현 결과](../u1-mobile-admin-onboarding/code-generation/code-summary.md)와 [검증 명령](../../verification-command.txt)을 적용했다.

| 검증 | 결과 |
|---|---|
| TypeScript 검사 및 Prisma·NestJS·Vite 출력 | 통과. Vite의 기존 의존성 번들 경고가 있었으며 종료 코드는 0 |
| 전체 Vitest | 35개 파일, 244개 통과, 0개 실패, 라인 86.89% (3,135/3,608) |
| 전체 Playwright Chromium | 5개 통과, 0개 실패. 새 설치·기존 로그인·초대·리마인더 대표 회귀 포함 |
| 승인된 U1 범위 재실행 | Vitest 7개 파일의 60개와 실제 Chromium 2개 통과. 전체 합계에는 중복 집계하지 않음 |
| 운영 가이드 | `git diff --check`와 Bash 코드 블록 구문 검사 통과. 준비·기동 서비스의 계정, 작업 디렉터리 및 환경 파일을 U5 예제와 대조 |
| 안드로이드 실기기 모바일 데이터 | 미수행. Deployment Execution과 운영 가이드 절차에 연결 |

244개에는 후보 취소·만료, 두 계정의 동시 시도와 중복 확인, 기존 설치, DB 이상, 커밋 전·후 SQLite 연결을 닫았다 다시 열어 확인하는 복구 테스트가 포함된다. 단위별 실행의 같은 테스트는 전체 합계에 추가하지 않는다.
