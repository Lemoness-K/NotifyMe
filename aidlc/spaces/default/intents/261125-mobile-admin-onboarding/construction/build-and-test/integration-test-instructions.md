# 모바일 최초 관리자 등록 통합 검증

[구현 계획](../u1-mobile-admin-onboarding/code-generation/code-generation-plan.md), [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md), [구현 결과](../u1-mobile-admin-onboarding/code-generation/code-summary.md)를 사용한다. 준비된 독립 SQLite, 합성 Firebase·Google 신원, 임시 HTTPS를 사용한다.

- 인증/HTTP: 후보와 기존 세션의 권한을 분리한다. 기존 이메일 기반 초대와 기존 사용자 로그인 경로를 회귀 검증한다.
- SQLite/운영: 두 계정·중복 확인과 취소가 중복 가구를 만들 수 없게 한다. 중단 시 DB 연결을 닫고 다시 열어 커밋 전·후 상태를 각각 확인한다. 이전 실제 암호화 스냅샷의 복원은 후보를 폐기한다.
- Chromium: 좁은 모바일 화면의 Google 인증 대체 경로에서 계정 표시→취소·새로고침→같은 계정 재인증→설정 시작→리마인더 저장·재조회의 전 구간을 확인한다.
- 독립 승인된 Android Chrome과 실제 Google/Firebase·모바일 데이터·Tailscale 경로는 배포 단계에서 [운영 가이드](../../../../../../../docs/u1-local-run.md#격리-검증과-의도적인-재설정)에 따라 검증한다.

이 경계의 명령은 [단위 테스트 지침](../u1-mobile-admin-onboarding/code-generation/unit-test-instructions.md)의 경로를 그대로 사용하고, [승인된 전체 검증 명령](../../verification-command.txt)으로 전체 커버리지와 브라우저 회귀를 확인한다.
