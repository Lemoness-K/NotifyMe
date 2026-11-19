# U2 엔티티

```yaml
entities:
  - name: Invitation
    description: 특정 가구에 지정 Google 계정을 초대하는 일회성 권한
    attributes:
      - {name: id, type: identifier, required: true, unique: true}
      - {name: household_id, type: identifier, required: true, references: Household}
      - {name: target_email, type: verified_email_comparison_value, required: false, constraints: 대기 중 필수이며 소비·취소·만료 시 삭제}
      - {name: token_hash, type: secret_digest, required: true, unique: true}
      - {name: created_by_user_id, type: identifier, required: true, references: User}
      - {name: created_at, type: instant, required: true}
      - {name: expires_at, type: instant, required: true, constraints: 발급 후 24시간}
      - {name: consumed_at, type: instant, required: false}
      - {name: consumed_by_user_id, type: identifier, required: false, references: User}
      - {name: revoked_at, type: instant, required: false}
    constraints: [소비와 취소는 상호 배타적, 만료는 서버 시각으로 계산, 비밀값 원문 저장 금지]
    relationships: [{target: Household, cardinality: many-to-one, direction: outgoing}]
  - name: Membership
    description: 가구에 대한 내부 사용자 권한 및 가입과 제거 이력
    attributes:
      - {name: household_id, type: identifier, required: true, references: Household}
      - {name: user_id, type: identifier, required: true, references: User}
      - {name: role, type: enum, required: true, allowed: [ADMIN, MEMBER], default: MEMBER}
      - {name: status, type: enum, required: true, allowed: [ACTIVE, REMOVED]}
      - {name: revision, type: integer, required: true, min: 0}
      - {name: joined_at, type: instant, required: true}
      - {name: left_at, type: instant, required: false}
      - {name: removed_by_user_id, type: identifier, required: false, references: User}
    constraints: [가구와 사용자 조합 유일, 활성 가구에 활성 Admin 한 명 이상, 종료 이력 보존]
    relationships:
      - {target: Household, cardinality: many-to-one, direction: outgoing}
      - {target: User, cardinality: many-to-one, direction: outgoing}
  - name: HousePolicy
    description: 가구 공통 설정의 논리적 읽기 모델
    attributes:
      - {name: household_id, type: identifier, required: true, unique: true, references: Household}
      - {name: default_time_zone, type: IANA_zone, required: true, default: Asia/Seoul, storage: Household}
      - {name: radius_m, type: integer_triplet, default: [50, 100, 500], storage: HouseholdSettings}
      - {name: max_location_duration_min, type: integer, min: 10, max: 1440, default: 60, storage: HouseholdSettings}
      - {name: weekly_calendar_convention, type: enum, allowed: [MONDAY_START, SUNDAY_START, ISO_8601], default: MONDAY_START, storage: HouseholdSettings}
      - {name: schema_version, type: integer, required: true}
      - {name: revision, type: integer, required: true, min: 0}
    constraints: [최소 반경 ≤ 기본 반경 ≤ 최대 반경, 프로필 필드와 설정은 하나의 논리 버전으로 변경]
    relationships: [{target: Household, cardinality: one-to-one, direction: outgoing}]
  - name: AccountPreferences
    description: 같은 사용자 계정의 표시 선호를 합친 논리적 읽기 모델
    attributes:
      - {name: user_id, type: identifier, required: true, unique: true, references: User}
      - {name: locale, type: locale_tag, required: false, allowed: [ko-KR, en-US], storage: UserSettings}
      - {name: time_zone, type: IANA_zone, required: false, storage: User}
      - {name: schema_version, type: integer, required: true}
      - {name: revision, type: integer, required: true, min: 0}
    constraints: [사용자 본인만 수정, 미저장 언어는 기기별 fallback, 표시 시간대는 일정 계산에서 사용하지 않음]
    relationships: [{target: User, cardinality: one-to-one, direction: outgoing}]
  - name: SettingDefinition
    description: 값에 대한 중앙 정의이며 각 소유자의 실제 값은 별도 보관
    attributes:
      - {name: key, type: identifier, required: true, unique: true}
      - {name: scope, type: enum, required: true, allowed: [HOUSEHOLD, USER, INSTALLATION, REMINDER]}
      - {name: definition_version, type: integer, required: true, min: 0}
      - {name: value_type, type: type_descriptor, required: true}
      - {name: default_value, type: setting_value, required: false}
      - {name: validation, type: rule_descriptor, required: true}
      - {name: storage_owner, type: identifier, required: true}
      - {name: disabled_behavior, type: policy_descriptor, required: true}
      - {name: retirement_behavior, type: policy_descriptor, required: true}
      - {name: migration, type: migration_descriptor, required: true}
    constraints: [키마다 정확히 한 scope 및 기준 저장 위치, 정의 버전과 값 revision을 분리]
    relationships: []
```

가구와 사용자 식별자는 U1을 사용한다. 초대는 가구에 속하고 Membership은 가구와 사용자를 잇는다. 가구 정책과 계정 선호는 논리적 읽기 모델이다. 기존 시간대 필드는 각각 `Household.default_time_zone` 및 `User.time_zone`에 유지한다. 설치·OS 값과 리마인더 값은 각 소유 컴포넌트에 둔다.
