# U2 용량 설계

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

- U2는 기존 단일 서버와 SQLite에서 실행한다. 목록에는 가구 경계를 포함한 안정 정렬과 페이지 제한을 사용한다. 설정 렌더링은 응답 값을 읽고 승인된 화면에서 필요한 리소스만 로드한다.
- 정리 작업은 한 번에 최대 100건을 처리하고 쓰기 잠금을 해제한 뒤 다음 묶음을 처리한다. 겹쳐 실행하지 않는다. 순서가 긴 작업보다 대화형 요청의 잠금 시간을 우선하며 실제 초대량 대비 밀린 대상 건수와 가장 오래된 항목을 관측한다.
- 최종 자원 한계는 DS-014에서 확정한다. 테스트 결과에 부하 모델, DB 크기, 동시 인증/쓰기 수를 함께 남긴다.
