# ADR-032: 반복 일정의 DST 현지 시각 처리

- 상태: 승인됨
- 날짜: 2026-11-09
- 결정: `D-064`
- 관련 결정: `D-061`, `D-062`, `D-065`
- 관련 요구사항: `PR-AC-050`, `NFR-TIME-003`
- 관련 문서: [마스터 설계](../00-master-design.md), [제품 요구사항](../01-product-requirements.md), [도메인·데이터 설계](../02-domain-and-data-design.md), [알림·스케줄링](../04-notification-and-scheduling.md)

## 배경

반복 일정은 특정 지역의 벽시계 시간으로 정의한다. DST 전환으로 그 현지 시각이 사라지거나 두 번 생길 수 있으므로, occurrence materialization과 기기 알람이 같은 기준을 사용해야 한다.

## 결정

- 반복 규칙은 현지 날짜·시각과 IANA time zone을 저장하고, 각 Occurrence의 실제 실행 instant는 UTC로 저장한다.
- DST 시작으로 현지 시각이 사라지면 전환 gap 길이만큼 앞으로 이동한다. 예를 들어 시계가 `02:00`에서 `03:00`으로 건너뛸 때 지정 시각 `02:30`은 `03:30`에 한 번 실행한다.
- DST 종료로 현지 시각이 두 번 생기면 먼저 발생한 instant에서 한 번 실행한다. 같은 recurrence key에 두 회차를 만들지 않는다.
- 월간 특정 날짜가 해당 월에 없는 경우의 건너뛰기 정책은 DST 처리와 별개로 `D-061`을 따른다.

## 결과

- 사용자가 지정한 벽시계 시각을 기준으로 반복 의미를 일관되게 유지한다.
- RecurrenceRule의 현지 시각·IANA zone과 Occurrence의 `scheduled_at_utc`를 함께 보존해 계산과 이력을 분리한다.
- DST를 사용하는 zone을 포함한 반복 경계 검증이 필요하다. 현재 기본 `Asia/Seoul`만으로는 DST 전환 사례를 검증할 수 없다.

## 구현 확인 사항

- 시간대 라이브러리의 IANA time zone database를 사용하고 UTC offset 약어를 zone 식별자로 저장하지 않는다.
- DST gap과 overlap 경계에서 occurrence·DeviceTrigger가 멱등하게 한 번만 생성되는지 검증한다.
- Android 기기의 현재 zone이 달라져도 서버에서 계산한 recurrence instant와 로컬 예약 목표 시각을 바꾸지 않는다.
