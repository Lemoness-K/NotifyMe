# U2 업무 규칙

```yaml
rules:
  - {id: BR2.1, category: authorization, applies_to: Invitation, trigger: 발급 또는 취소, logic: 같은 가구의 활성 Admin만 변경 가능, violation: 403, source: [FR1.7, FR1.8]}
  - {id: BR2.2, category: constraint, applies_to: Invitation, trigger: 링크 발급 및 생애주기 변경, logic: 원문은 무작위로 생성해 첫 발급 응답에만 노출하고 GET은 읽기만 수행하며 미소비·미취소·미만료일 때만 수락 가능하고 종결 시 대상 이메일을 제거, violation: 일반화된 수락 실패, source: [FR1.7]}
  - {id: BR2.3, category: authorization, applies_to: Invitation, trigger: 명시적 수락, logic: 검증된 Google 이메일이 같은 대상이어야 하며 외부 발급자와 주체가 내부 사용자에 연결되고 원자적으로 MEMBER 소속과 초대 소비를 저장, violation: 상태 변경 없음, source: [FR1.5, FR1.7]}
  - {id: BR2.4, category: authorization, applies_to: Membership, trigger: 역할 또는 가구 정책 변경, logic: 현재 가구의 활성 Admin과 대상의 최신 revision을 확인, violation: 403 또는 409, source: [FR1.8, FR7.1]}
  - {id: BR2.5, category: constraint, applies_to: Membership, trigger: Admin 강등 또는 제거, logic: 현재 활성 Admin 수를 쓰기 경계 안에서 확인하고 마지막 한 명이면 같은 가구의 다른 활성 MEMBER 승격과 한 번에 반영, violation: 409 전체 변경 거절, source: [FR1.8]}
  - {id: BR2.6, category: policy, applies_to: Membership, trigger: 구성원 제거, logic: 소속 비활성화와 배정·서버 대상 정리 및 회수 기록은 함께 커밋하고 공유 이력은 보존, violation: 실패 시 모두 롤백, source: [FR1.9, FR1.10]}
  - {id: BR2.7, category: policy, applies_to: SettingDefinition, trigger: 정의 등록 및 사용, logic: 키 하나에 한 scope와 기준 저장소를 지정하고 default·자료형·검증·비활성·폐기 및 마이그레이션을 선언, violation: 모호하거나 검증되지 않은 정의는 등록 거절, source: [FR7.1, FR7.6, FR7.12]}
  - {id: BR2.8, category: authorization, applies_to: AccountPreferences, trigger: 계정 설정 조회 또는 변경, logic: 인증된 본인 계정의 값을 사용하며 설치 간 읽기를 공유하고 수정은 revision을 확인, violation: 401 또는 409 또는 422, source: [FR7.1, FR7.2, FR7.12]}
  - {id: BR2.9, category: policy, applies_to: AccountPreferences, trigger: UI 렌더링, logic: 지원되는 저장 locale 다음 지원되는 기기 locale 다음 ko-KR 순으로 선택하고 번역 키와 원문을 구분, violation: 지원 리소스로 fallback, source: [FR7.2, FR7.4, FR7.5, NFR7.1, NFR7.2]}
  - {id: BR2.10, category: validation, applies_to: HousePolicy, trigger: 반경 정책 변경, logic: 미터 정수의 최소 ≤ 기본 ≤ 최대를 확인하고 경계 밖 활성·보관 Trigger를 가장 가까운 경계로 조정하며 변경 이력과 함께 커밋, violation: 422 또는 효과 적용 실패 시 전체 롤백, source: [FR7.8, FR7.9]}
  - {id: BR2.11, category: validation, applies_to: HousePolicy, trigger: 장소 시간 상한 변경 또는 새 조건 확인, logic: 상한 10~1440분 기본 60분이고 새 조건 및 수정할 기간에 현재 상한 적용, violation: 422 및 기존 조건 유지, source: [FR7.10]}
  - {id: BR2.12, category: policy, applies_to: HousePolicy, trigger: 새 일정 또는 반복 규칙 생성, logic: 현재 가구 기본 시간대와 달력 기준을 해당 규칙에 저장하고 기존 규칙은 보존, violation: 지원되지 않는 값은 422, source: [FR7.4, FR7.11]}
  - {id: BR2.13, category: policy, applies_to: AccountPreferences, trigger: 화면 표시 또는 설정 이동, logic: 저장된 IANA 표시 시간대에 맞춰 표시하고 일정 계산과 OS 제어는 해당 소유 경계에서 처리, violation: 유효하지 않은 새 시간대는 422, source: [FR7.3, FR7.4, FR7.7, FR7.12]}
  - {id: BR2.14, category: constraint, applies_to: SettingDefinition, trigger: 비활성화 또는 폐기, logic: 선언된 마이그레이션을 적용하고 기존 설정값과 이력을 보존 정책에 따라 처리, violation: 불완전한 마이그레이션에서는 정의 전환 중단, source: [FR7.6]}
```

| 규칙 | 적용 |
| --- | --- |
| BR2.1~BR2.3 | 초대 권한과 기간, 명시적 수락, 검증된 이메일과 초대 소비 |
| BR2.4~BR2.6 | 역할 변경, 마지막 Admin, 접근 회수 |
| BR2.7~BR2.9, BR2.13~BR2.14 | 설정 소유권, 계정 표시와 현지화, 정의 변경 |
| BR2.10~BR2.12 | 장소 반경·시간·달력의 가구 정책 |
