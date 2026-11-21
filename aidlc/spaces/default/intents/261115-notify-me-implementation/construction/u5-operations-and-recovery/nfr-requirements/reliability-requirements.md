# U5 reliability-requirements

## Sources

`functional-spec.md`와 `rules.md`, `requirements.md`, `contract-summary.md`, `technology-stack.md`를 따른다.

## Requirements

- NFR3.1.5. REQUESTED의 독립 최신점 반영 전 운영 삭제를 하지 않는다. 종결 증거의 반영 전에 성공을 응답하지 않는다. 각 저장과 공개 전환 사이에 중단을 주입한다.
- NFR3.2.5. 동일 백업 실행 ID·삭제 요청·장애 상태·보고 주기의 재실행에서 확정된 작업이나 사용자 데이터 변경을 중복 적용하지 않는다.
- NFR3.3.5. 복원 뒤 기존 서버 세대의 커서에는 FULL로 응답한다. 이전 revision이 일치해도 DELTA를 전송하지 않는지 검사한다.
- NFR3.4.5. 오래된 실제 SQLite 사본을 격리 복원한다. 삭제 재적용, 동일 계보의 잘린 원장, 증거 누락·미확정·오류, 후보 전환 전후 재시작을 검증한다.
- NFR4.1.5. 백업과 장애 시각은 UTC로 저장하고 주간 요약에서는 운영 시간대를 명시한다. 기존 가구 및 규칙의 IANA 시간대는 내용 그대로 복원한다.
