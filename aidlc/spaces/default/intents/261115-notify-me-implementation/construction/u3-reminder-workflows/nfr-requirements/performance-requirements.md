# U3 성능 요구사항

## Sources

U3의 `functional-spec.md` 및 `rules.md`, 승인된 `requirements.md`, `contract-summary.md`, `technology-stack.md`와 현재 U1·U2의 실행 환경을 사용한다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR5.1.3 | 대표 할 일·상세·이력 요청의 응답 p95는 DS-014 대상 Raspberry Pi 측정에서 500ms 이하 | 장치, 데이터량, 동시성, 측정창은 DS-014에 고정한다. 타이머·삭제 작업 유무와 인증 시간도 기록한다. |
| NFR5.2.3 | 반복 생성과 삭제 기록의 피크 메모리 및 저장장치 쓰기는 DS-014에서 승인할 예산을 충족 | 연속 회차와 동시 삭제·검증을 포함해 정상 부하와 밀린 작업 처리 부하를 따로 측정한다. 예산 확인 전에는 판정하지 않는다. |
