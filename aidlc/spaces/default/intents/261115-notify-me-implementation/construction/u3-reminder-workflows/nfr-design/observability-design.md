# U3 관측 설계

## Sources

U3의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`와 공통 `contract-summary.md`를 따른다.

- NFR10.1.3. 기존 구조화 로그에 요청 ID, 안정된 명령·전이 코드, 처리 시간과 성공·경합·일시 장애를 남긴다. 반복 행에는 실행 ID와 건수·재시도 횟수를, 삭제 행에는 불투명 작업 ID와 내구 처리 위치 및 상태를 기록한다.
- 미확정 삭제 수와 가장 오래된 요청의 경과 시간을 로컬에서 관측한다. 미확정 상태가 생기면 즉시 경고 이벤트를 기록하고, 경과 시간 기준과 별도 운영 알림 정책은 U5에 넘긴다. 중복 로그로 상태를 잘못 집계하지 않도록 같은 작업 ID와 최신 증거를 사용한다.
- NFR10.2.3. 임시 진단 로그와 독립 저널은 앱 공개 경로와 분리한다. 제목·설명·좌표·자격 증명·개인 원문은 로그로 이동하지 않는다. 승인된 운영자만 요청 및 스냅샷 기준점 증거를 확인한다.
