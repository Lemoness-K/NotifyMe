# U3 성능 설계

## Sources

U3의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`와 공통 `contract-summary.md`를 따른다.

- NFR5.1.3. 가구 ID, lifecycle, 회차 상태와 일정 또는 상태 시간을 선행 조회 키로 사용한다. 커서에 조회 범위와 안정 정렬 키를 묶고 필요한 DTO 필드만 읽는다. 개인·가구 데이터에는 공유 캐시를 두지 않는다. 인증 포함 대표 읽기의 p95 500ms 합격은 DS-014의 장치·부하·측정창이 확정된 이후 평가한다.
- NFR5.2.3. 짧은 SQLite 쓰기와 유한 반복 작업 묶음을 사용한다. 반복 작업은 고정 크기 페이지로 다음 기준을 읽고 트랜잭션 사이에 제어를 반환한다. DS-014에서 승인할 피크 RSS 및 저장 쓰기량을 정상 흐름과 밀린 반복·삭제 흐름으로 나눠 측정한다. 개발 결과를 Pi 합격 근거로 바꾸지 않는다.
