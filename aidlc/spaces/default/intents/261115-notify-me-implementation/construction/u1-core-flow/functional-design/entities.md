# U1 데이터 모델

## Sources

`unit-of-work.md`, `unit-of-work-story-map.md`, `stories.md`, `requirements.md`, `components.md`, `contract-summary.md`.

```yaml
entities:
  - name: User
    description: 내부 사용자
    attributes:
      - {name: id, type: opaque-id, required: true, unique: true}
      - {name: displayName, type: text, required: false}
      - {name: active, type: boolean, required: true, default: true}
  - name: AuthIdentity
    description: 검증된 외부 신원과 내부 사용자의 연결
    attributes:
      - {name: issuer, type: text, required: true}
      - {name: subject, type: text, required: true}
      - {name: userId, type: opaque-id, required: true, references: User.id}
    constraints: ["issuer + subject 유일", "토큰과 비밀번호 저장 금지"]
  - name: AuthSession
    description: 설치별 앱 세션과 서버 측 종료 상태
    attributes:
      - {name: id, type: opaque-id, required: true, unique: true}
      - {name: userId, type: opaque-id, required: true, references: User.id}
      - {name: credentialDigest, type: digest, required: true, unique: true}
      - {name: expiresAt, type: instant, required: true}
      - {name: endedAt, type: instant, required: false}
  - name: Household
    description: 가구와 데이터 격리의 소유 범위
    attributes:
      - {name: id, type: opaque-id, required: true, unique: true}
      - {name: defaultTimeZone, type: iana-time-zone, required: true}
    constraints: ["MVP 초기 가구 설정은 한 번만 커밋"]
  - name: Membership
    description: 사용자와 가구의 활성 소속
    attributes:
      - {name: householdId, type: opaque-id, required: true, references: Household.id}
      - {name: userId, type: opaque-id, required: true, references: User.id}
      - {name: role, type: enum, required: true, values: [ADMIN, MEMBER]}
      - {name: active, type: boolean, required: true, default: true}
    constraints: ["householdId + userId 유일"]
  - name: Reminder
    description: 공유 가구 리마인더
    attributes:
      - {name: id, type: opaque-id, required: true, unique: true}
      - {name: householdId, type: opaque-id, required: true, references: Household.id}
      - {name: title, type: text, required: true}
      - {name: description, type: text, required: false}
      - {name: createdBy, type: opaque-id, required: true, references: User.id}
      - {name: requesterId, type: opaque-id, required: true, references: User.id}
      - {name: revision, type: nonnegative-integer, required: true}
    constraints: ["공백만 있는 제목은 거부", "출처 입력 원문 보존", "등록 시 requesterId는 해당 가구 활성 구성원"]
  - name: Assignment
    description: 리마인더 담당자 연결
    attributes:
      - {name: reminderId, type: opaque-id, required: true, references: Reminder.id}
      - {name: userId, type: opaque-id, required: true, references: User.id}
    constraints: ["reminderId + userId 유일", "등록 시 활성 가구원 최소 1명"]
  - name: Trigger
    description: U1 시간 리마인더의 예약 조건
    attributes:
      - {name: reminderId, type: opaque-id, required: true, unique: true, references: Reminder.id}
      - {name: kind, type: enum, required: true, values: [TIME]}
      - {name: scheduledAt, type: instant, required: true}
      - {name: timeZone, type: iana-time-zone, required: true}
  - name: Occurrence
    description: U1에서 생성하는 최초 단일 회차
    attributes:
      - {name: id, type: opaque-id, required: true, unique: true}
      - {name: reminderId, type: opaque-id, required: true, references: Reminder.id}
      - {name: scheduledAt, type: instant, required: true}
      - {name: state, type: enum, required: true, values: [PENDING], default: PENDING}
      - {name: revision, type: nonnegative-integer, required: true}
    constraints: ["U1 단발 생성당 최초 회차 1개", "승인된 회차 계약에 반환"]
  - name: IdempotencyRecord
    description: 같은 등록 요청의 재시도를 기존 결과에 연결
    attributes:
      - {name: scopeKey, type: opaque-id, required: true, unique: true}
      - {name: inputDigest, type: digest, required: true}
      - {name: resultReminderId, type: opaque-id, required: true, references: Reminder.id}
    constraints: ["검증된 사용자 + 가구 + 동작 + 키의 범위", "업무 등록과 함께 커밋"]
relationships:
  - {from: User, to: AuthIdentity, cardinality: "1:N"}
  - {from: User, to: AuthSession, cardinality: "1:N"}
  - {from: Household, to: Membership, cardinality: "1:N"}
  - {from: User, to: Membership, cardinality: "1:N"}
  - {from: Household, to: Reminder, cardinality: "1:N"}
  - {from: Reminder, to: Assignment, cardinality: "1:N"}
  - {from: Reminder, to: Trigger, cardinality: "1:1"}
  - {from: Reminder, to: Occurrence, cardinality: "1:1 in U1"}
  - {from: Reminder, to: IdempotencyRecord, cardinality: "1:N"}
```

사용자는 외부 신원과 앱 세션을 별도로 가진다. 가구에는 소속과 리마인더가 있고, U1에서 리마인더는 시간 조건과 최초 회차를 한 건씩 가진다. 반복·장소·완료의 확장 모델은 U3에서 다룬다.
