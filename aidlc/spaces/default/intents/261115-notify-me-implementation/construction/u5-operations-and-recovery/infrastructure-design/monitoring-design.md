# U5 monitoring-design

## Sources

`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `components.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Monitoring

- NFR10.1.5, NFR10.2.5. journald에는 실행 ID·상태·시각·계수만 남긴다. 호스트 점검 명령에서 systemd, 로컬 헬스, 자원과 백업 결과를 확인하고 운영 소켓의 공개 경로가 없음을 검증한다.
- NFR4.1.5, NFR7.4.5. 날짜 경계는 설정한 운영 시간대로 계산하고 로그에는 UTC 시각과 구조화 상태 코드를 저장한다. 선택 기능은 서버 운영 설정으로 기본 꺼짐이며 주간 보고와 장애 기록을 독립 활성화한다. 로컬에서 관측 가능한 서비스 장애만 다루며 외부 전달은 후속이다.
- NFR5.1.5, NFR5.2.5. DS-014에서는 백업 중 API 응답, 피크 RSS, 쓰기량과 삭제 대기 시간을 측정한다. 코드 검증에서 처리 시간·자원 표본을 남기더라도 대상 Pi 측정을 대신하지 않는다.
