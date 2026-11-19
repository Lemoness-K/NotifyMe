# U3 관측 요구사항

## Sources

U3의 `functional-spec.md` 및 `rules.md`, 승인된 `requirements.md`, `contract-summary.md`, `technology-stack.md`와 현재 U1·U2의 실행 환경을 사용한다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR10.1.3 | 업무 처리, 동시 충돌, 반복 작업, 삭제 미확정과 확정 실패를 로컬 로그로 구분 가능 | 요청 ID와 삭제 작업 ID를 인가 경계 내에서 추적하고 정상·지연·실패 상태를 분리한다. |
| NFR10.2.3 | 관리용 삭제·복구 표면은 공용 API에서 접근할 수 없고 비밀이나 좌표·제목을 로그에 저장하지 않는다 | 정상 입력과 실패 입력을 보호된 합성 환경에서 확인한다. |
