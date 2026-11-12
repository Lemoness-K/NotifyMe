# ADR-009: 장소 조건 event별 재알림

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-014`, `D-016`, `D-030`, `D-041`, `D-075`
- 관련 요구사항: `PR-AC-016`, `PR-AC-060`, `F-TRG-004`, `F-NOT-005`

## 맥락

장소 조건이 한 번 발생해 알림한 뒤에도 사용자가 회차를 완료하지 않을 수 있다. 같은 장소 안에
계속 머무는 동안 반복 알림하면 중복 callback이나 지속 상태 때문에 알림이 쌓일 수 있고, 반대로
새로운 진입·이탈 등 이후 조건 발생을 무시하면 미완료 할 일이 다시 보이지 않을 수 있다.

## 결정

Occurrence가 `PENDING`이고 Reminder가 활성 상태일 때, 기기에서 새로 인식한 각각의 LOCATION
condition event마다 한 번 알림한다. 같은 조건 event의 callback 재전달·재처리는 멱등 처리하고,
동일한 연속 상태가 이어지는 동안 별도 event를 만들지 않는다.

- `ENTER`와 `EXIT`: 각각 새로 인식된 전이마다 event를 만든다.
- `DWELL(N)`: 한 번의 끊기지 않은 체류 구간이 N분에 도달할 때 event 하나를 만든다. 그 전에
  이탈하면 해당 구간은 끝나며, 다시 들어온 뒤 N분을 채우면 새 event다.
- `AFTER_EXIT(N)`: 이탈 후 N분 countdown이 만료될 때 event 하나를 만든다. 만료 전에 재진입하면
  countdown을 취소한다. 이후 다시 이탈하면 그 시점부터 N분을 새로 센다(`D-016`).

기기는 마지막으로 인정한 inside/outside 상태와 전이 sequence를 영속화한다. 반대 전이 없이 같은
방향으로 반복 도착한 callback은 새 조건으로 인정하지 않는다. 인정된 전이, dwell 구간의 만료,
`AFTER_EXIT` countdown 만료마다 해당 설치의 `installation_id`, `occurrence_id`, trigger revision과
함께 고유한 `condition_event_id`를 만든다. ID와 처리 상태를 기기 local event journal에 저장해 동일
OS callback이나 프로세스 재생성에 따른 중복 알림을 막는다. event가 서버로 동기화될 때도 같은 ID를
사용해 서버 측 중복 처리를 막는다. 서로 다른 event ID는 별도 알림이며 OS notification ID도
event별로 다르게 만들어 이후 조건 알림이 이전 알림을 대체하지 않게 한다.

회차가 완료·취소·놓침·건너뛰기 상태가 되었거나 Reminder가 보관되면 이후 장소 callback은 알림을 만들지
않는다. 위치 알림 자체는 회차를 자동 완료하거나 종료하지 않는다(`D-030`).

## 결과

- 장소 알림을 받은 뒤 미완료 상태가 유지되면 새로운 조건 발생을 다시 알 수 있다.
- 동일 callback 재전달은 중복 표시되지 않으며, 후속의 별도 조건은 각자 알림 기록을 가진다.
- 이벤트 ID, 알림 식별자, 처리 결과가 이벤트별이므로 location event deduplication과 시간 알림의
  회차별 deduplication 규칙을 분리한다.
- 장소 event data minimization과 보존 기간은 `D-043`에서 정한다. 조건 인식 뒤 알림 게시 시점은 `D-042`에서 정한다.
