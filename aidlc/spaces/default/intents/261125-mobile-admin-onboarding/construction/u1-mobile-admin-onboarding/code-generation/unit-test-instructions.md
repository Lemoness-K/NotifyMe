# U1 모바일 최초 관리자 등록 테스트

## 도구와 실행

현재 `vitest.config.ts`의 Node·Vitest와 임시 SQLite, React DOM 테스트, 기존 Playwright Chromium 프로젝트를 사용한다. 새 테스트 전에는 같은 명령의 기존 테스트 파일이 실행되는지 확인한다.

```bash
npm run test:unit -- tests/u1/auth-session.test.ts tests/u1/http.test.ts tests/u2/http.test.ts tests/u5/runtime.test.ts tests/u1/mobile-admin-onboarding.test.ts tests/u1/mobile-admin-onboarding-web.test.tsx tests/u5/mobile-admin-onboarding-operations.test.ts
```

```bash
npm run test:e2e -- tests/e2e/u1/core-flow.spec.ts
```

## 검증 범위

- 인증·후보 5~8개 이상. 최초 예약, 다른 계정·옛 자격 거부, 취소·만료·재인증, 증명 재사용, 동시 확인, 커밋 이전 롤백과 기존 가구 재시도.
- 운영·저장 5~8개 이상. 새 SQLite 준비, 기존 DB와 빈 경로 차단, DB 읽기 실패, 복원·가구 종료, 진행 기록 후 커밋 전/커밋 후 재기동, 전환 경쟁.
- 웹 5~8개 이상. 계정과 지정 문구, 설정 시작·취소, 중복 제출 창, 응답 유실 안내, 새로고침·계정 전환, 성공 후 리마인더 저장.
- 기존 로그인·세션·초대 경로와 새 후보에 대한 업무 API 거부.
- 실제 Pi ARM64와 Wi-Fi를 끈 Android Chrome은 배포 검증에서 합성 데이터로 별도 수행한다. Chromium 결과만으로 실제 휴대폰 검증을 통과했다고 기록하지 않는다.

## 테스트 데이터와 커버리지

임시 디렉터리의 SQLite와 합성 Google/Firebase provider, 고정 시계, 실패 주입을 사용한다. 운영 경로와 운영 인증 설정은 로드하지 않는다. 전체 프로젝트 라인 커버리지 최소 80%는 빌드·테스트 단계에서 전체 suite로 확인하며, 이 단위의 결과는 별도로 기록한다.
