# Notify Me 범위 정의 질문

## Sources

- [intent:Q1, Q10–Q14] 이번 작업에서 선택적 완료 검증과 검증 실패·미응답 처리를 요청했다.
- [intent:Q7, Q13] 운영자 주간 보고와 장애 발생 즉시 알림을 초기 선택 기능으로 요청했다.
- [intent:Q12] 첫 버전은 현재 설계 문서의 MVP로 제한하고 후속 기능은 이번 작업에서 제외한다고 답했다.
- [docs:00-master-design.md §6–§7; 01-product-requirements.md §2–§3, §6] 현재 MVP 범위에는 완료 검증, 운영자 주간 보고, 장애 알림이 없다.
- [docs:09-feature-design-coverage-and-backlog.md §4] 기존 MVP 상세 설계는 준비 목록이며, 코드와 테스트는 아직 시작되지 않았다.

## Q1. [제품] 선택적 완료 검증의 MVP 포함 여부 — Q-063

이번 의도에서 요청한 선택적 완료 검증은 기존 마스터 설계와 제품 요구사항의 MVP 범위에 들어 있지 않습니다. 동시에 첫 버전은 현재 문서의 MVP만 포함한다고 답하셨습니다. 이번 작업에서 이를 범위 추가로 포함할지 정해야 합니다.

- A. 이번 MVP 포함 (Recommended)
- B. 후속 단계로 미루기
- X. Other (please specify)

[Answer]: A. 이번 MVP 포함 (Recommended)

## Q2. [운영] 운영자 보고·장애 알림의 MVP 포함 여부 — Q-064

이번 의도에서 요청한 주간 운영 보고와 즉시 장애 알림은 기존 MVP 문서에 없습니다. 기존 MVP에는 systemd·journald·로컬 헬스체크와 명령 기반 상태 점검이 포함되어 있습니다. 보고·알림 기능을 이번 작업의 범위에 추가할지 정해야 합니다.

- A. 이번 MVP 포함 (Recommended)
- B. 후속 단계로 미루기
- X. Other (please specify)

[Answer]: A. 이번 MVP 포함 (Recommended)

## Consolidated Summary Confirmation

- 기존 설계 문서의 MVP가 기준으로 유지되고, 선택적 완료 검증은 이번 작업의 MVP에 추가된다. 검증자 확인·거절·미응답 동작은 후속 요구사항과 상세 설계에서 구체화한다. [Q-063]
- 운영자 주간 보고와 즉시 장애 알림도 이번 작업의 MVP에 추가된다. 전달 채널과 장애 판정 기준은 후속 상세 설계에서 정한다. [Q-064]
- 기존 설계 문서에서 후속 단계로 분류한 나머지 기능은 이번 작업에서 제외한다. 실제 Raspberry Pi 설치와 외부 네트워크 공개도 포함하지 않는다. [intent:Q9, Q12]
- 기존 설계 문서는 계속 기준 문서로 사용하며, 승인된 범위 추가를 관련 문서와 추적표에 반영한다.

이 범위 요약이 모두 맞나요? 범위 산출물을 작성하기 전에 확인해 주세요.

- Looks correct
- Request changes

[Answer]: Looks correct
