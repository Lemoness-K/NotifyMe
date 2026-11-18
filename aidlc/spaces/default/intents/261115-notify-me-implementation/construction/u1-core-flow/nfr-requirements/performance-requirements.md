# U1 성능 요구사항

## Sources

U1의 `functional-spec.md`, `rules.md`, Inception `requirements.md`, `contract-summary.md`와 CodeKB `technology-stack.md`를 기준으로 한다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR5.1.1 | 로그인 완료 뒤 목록·상세 등 대표 서버 화면 요청의 응답 p95는 승인된 Raspberry Pi 부하 모델에서 500ms 이하다. | DS-014가 대상 장치, 데이터량, 동시 요청, 미리 준비할 상태 및 측정 구간을 확정한 뒤 원자료와 p95를 비교한다. 개발 호스트의 숫자는 기준선으로만 기록한다. |
| NFR5.2.1 | 실행 중 메모리 최대값과 저장장치 쓰기량은 DS-014에서 수치로 승인한 예산 이내여야 한다. | 대상 장치와 동일한 부하에서 측정하고 결과를 예산과 대조한다. 기준 확정 전 상태는 검증 대기다. |
