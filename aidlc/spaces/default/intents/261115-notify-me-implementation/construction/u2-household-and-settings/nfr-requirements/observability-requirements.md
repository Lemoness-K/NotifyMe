# U2 관측과 운영 진단 요구사항

## Sources

U2 `functional-spec.md`와 `rules.md`, Inception `requirements.md`와 `contract-summary.md`, CodeKB `technology-stack.md`를 근거로 한다. 현재 실행 스택은 U1의 `package.json`, `package-lock.json` 및 `docs/u1-local-run.md`에서 확인했다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR10.1.2 | 권한 실패, 역할 충돌, 초대 처리 실패, 만료 정리 실패, 설정 쓰기 실패를 요청 ID 또는 정리 실행 ID와 제한된 안정 코드로 식별할 수 있다. | 로컬 구조화 로그와 요청 결과를 대조하고 둘 이상의 동시 실패에서도 구분이 되는지 확인한다. |
| NFR10.2.2 | 기존 로컬 헬스 경계를 재사용한다. 초대 비밀과 이메일을 요청·에러·접근 로그 및 진단 노출에 포함하지 않는다. | 정상·거부·재발급 요청을 통과시킨 뒤 진단과 HTTPS 진입 로그를 대조한다. |
