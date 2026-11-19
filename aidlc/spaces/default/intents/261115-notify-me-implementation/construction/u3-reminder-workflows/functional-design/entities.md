# U3 엔티티

```yaml
entities:
  - name: Reminder
    description: 가구 소유 업무
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: household_id, type: identifier, required: true}
      - {name: created_by, type: identifier, required: true}
      - {name: requester_user_id, type: identifier, required: true}
      - {name: title, type: text, required: true}
      - {name: description, type: text, required: false}
      - {name: lifecycle, type: enum, required: true}
      - {name: revision, type: integer, required: true}
      - {name: archived_at, type: instant, required: false}
      - {name: verification_enabled, type: boolean, required: true}
      - {name: verifier_user_id, type: identifier, required: false}
    constraints:
      - 가구에 속한 작성자와 요청자 및 현재 담당자를 분리
      - 검증을 새로 설정할 때 다른 담당자 및 활성 소속 검사
      - 영구 삭제하면 업무 행과 상세 이력을 제거
    relationships:
      - {target: Household, cardinality: many-to-one, direction: outgoing}
  - name: Assignment
    description: 담당자의 활성 배정과 이전 배정
    attributes:
      - {name: reminder_id, type: identifier, required: true}
      - {name: household_id, type: identifier, required: true}
      - {name: user_id, type: identifier, required: true}
      - {name: assigned_at, type: instant, required: true}
      - {name: ended_at, type: instant, required: false}
    constraints:
      - 같은 업무와 사용자에 활성 배정은 한 개
      - 종료 이력 보존
    relationships:
      - {target: Reminder, cardinality: many-to-one, direction: outgoing}
      - {target: Membership, cardinality: many-to-one, direction: outgoing}
  - name: Trigger
    description: 시간 또는 장소 조건
    attributes:
      - {name: reminder_id, type: identifier, required: true}
      - {name: kind, type: enum, required: true}
      - {name: scheduled_at, type: instant, required: false}
      - {name: time_zone, type: IANA_zone, required: false}
      - {name: latitude, type: coordinate, required: false}
      - {name: longitude, type: coordinate, required: false}
      - {name: place_name, type: text, required: false}
      - {name: radius_m, type: integer, required: false}
      - {name: event, type: enum, required: false}
      - {name: duration_min, type: integer, required: false}
    constraints:
      - 시간과 장소 조건은 상호 배타적
      - 지속 시간은 DWELL 또는 AFTER_EXIT에만 요구
      - 좌표는 노출 범위 제한
    relationships:
      - {target: Reminder, cardinality: one-to-one, direction: outgoing}
  - name: RecurrenceRule
    description: 저장된 반복 계산 기준
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: reminder_id, type: identifier, required: true}
      - {name: frequency, type: enum, required: true}
      - {name: interval, type: integer, required: true}
      - {name: local_start, type: local_datetime, required: true}
      - {name: time_zone, type: IANA_zone, required: true}
      - {name: end_date, type: local_date, required: false}
      - {name: weekly_convention, type: enum, required: false}
      - {name: anchor_week, type: local_date, required: false}
      - {name: weekdays, type: enum_set, required: false}
      - {name: month_day, type: integer, required: false}
      - {name: last_day, type: boolean, required: false}
      - {name: effective_from, type: occurrence_key, required: false}
    constraints:
      - 끝날의 현지 날짜 포함
      - 유효 적용 경계 이전 회차 참조 보존
    relationships:
      - {target: Reminder, cardinality: many-to-one, direction: outgoing}
  - name: Occurrence
    description: 고유 회차와 현재 진행 상태
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: reminder_id, type: identifier, required: true}
      - {name: occurrence_key, type: stable_key, required: true}
      - {name: scheduled_at, type: instant, required: false}
      - {name: status, type: enum, required: true}
      - {name: revision, type: integer, required: true}
      - {name: status_at, type: instant, required: true}
      - {name: reason, type: enum, required: false}
    constraints:
      - 업무와 occurrence key 조합 유일
      - 업무 수명주기와 독립
    relationships:
      - {target: Reminder, cardinality: many-to-one, direction: outgoing}
  - name: OccurrenceOverride
    description: 개별 회차에만 적용하는 예외
    attributes:
      - {name: occurrence_id, type: identifier, required: true}
      - {name: patch, type: validated_fields, required: true}
    constraints:
      - 원래 회차 식별자와 반복 규칙 보존
    relationships:
      - {target: Occurrence, cardinality: one-to-one, direction: outgoing}
  - name: Completion
    description: 완료 및 검증 시도 기록
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: occurrence_id, type: identifier, required: true}
      - {name: submitted_by, type: identifier, required: true}
      - {name: verifier_user_id, type: identifier, required: false}
      - {name: state, type: enum, required: true}
      - {name: requested_at, type: instant, required: true}
      - {name: responded_at, type: instant, required: false}
      - {name: response_actor_id, type: identifier, required: false}
      - {name: reason, type: enum, required: false}
    constraints:
      - 회차별 검증 대기 한 건
      - 완료자와 검증 행위자를 구분
      - 철회와 회수 시 지난 요청을 재사용하지 않음
    relationships:
      - {target: Occurrence, cardinality: many-to-one, direction: outgoing}
  - name: AuditEvent
    description: 사용자 공개 범위의 업무 변경 이력
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: household_id, type: identifier, required: true}
      - {name: reminder_id, type: identifier, required: true}
      - {name: occurrence_id, type: identifier, required: false}
      - {name: actor, type: actor_ref, required: true}
      - {name: event, type: enum, required: true}
      - {name: at, type: instant, required: true}
      - {name: changes, type: filtered_fields, required: true}
    constraints:
      - 장소 좌표와 자격 증명은 이력에 넣지 않음
    relationships:
      - {target: Reminder, cardinality: many-to-one, direction: outgoing}
  - name: ChangeFeedEntry
    description: 가구별 동기화 변경
    attributes:
      - {name: household_id, type: identifier, required: true}
      - {name: revision, type: integer, required: true}
      - {name: entity_id, type: identifier, required: true}
      - {name: change_kind, type: enum, required: true}
      - {name: changed_at, type: instant, required: true}
    constraints:
      - 가구와 revision 조합 유일
      - 삭제 표지는 승인된 30일 이내
    relationships: []
  - name: DeletionRecord
    description: 독립 보존하는 삭제 검증 기록
    attributes:
      - {name: journal_position, type: monotonic_integer, required: true, unique: true}
      - {name: request_id, type: identifier, required: true}
      - {name: household_id, type: identifier, required: true}
      - {name: reminder_id, type: identifier, required: true}
      - {name: state, type: enum, required: true}
      - {name: revision, type: integer, required: false}
      - {name: occurred_at, type: instant, required: true}
      - {name: integrity_proof, type: opaque_proof, required: true}
    constraints:
      - 삭제 요청 및 확정과 중단을 같은 작업 ID로 연결
      - 같은 작업 ID의 REQUESTED 및 하나의 종결 기록을 각각의 위치에 저장하고 덮어쓰지 않음
      - 운영 DB 커밋 증거는 작업 ID와 가구와 대상 및 삭제 revision에 결합
      - 원문과 이력을 저장하지 않음
    relationships: []
```

Reminder와 Occurrence는 수명주기와 진행 상태를 분리한다. Completion은 회차 단위 검증 시도 이력을 갖고, Assignment는 접근 회수 시 종료한다. 사용자 감사 이력과 설치 동기화 피드는 목적과 수명을 분리한다. 독립 삭제 기록은 운영 DB와 별도 내구 경계를 갖는다.
