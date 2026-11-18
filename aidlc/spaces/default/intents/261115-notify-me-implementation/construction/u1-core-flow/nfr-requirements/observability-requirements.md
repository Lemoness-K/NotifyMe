# U1 관측과 운영 진단 요구사항

## Sources

U1의 `functional-spec.md`, `rules.md`, Inception `requirements.md`, `contract-summary.md`와 CodeKB `technology-stack.md`를 기준으로 한다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR10.1.1 | U1 운영자는 인증·인가 거절, 저장 실패, 최초 설정 결과 및 서버 상태를 제한된 경로에서 진단할 수 있다. | 실패 응답의 요청 ID로 관련 구조화 로그를 찾을 수 있다. 로그는 안정된 코드·결과를 포함하고 인증 비밀이나 사용자 작성 원문을 포함하지 않는다. |
| NFR10.2.1 | 헬스·관리 설정과 비밀은 서비스 공개 표면에서 접근할 수 없다. | 동일 상태를 허용된 로컬 경로와 공개 경로에서 각각 조회하여 로컬 접근만 성립하는지 확인한다. |
