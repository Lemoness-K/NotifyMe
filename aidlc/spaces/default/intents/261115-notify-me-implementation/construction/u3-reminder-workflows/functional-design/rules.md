# U3 업무 규칙

```yaml
rules:
  - {id: BR3.1, category: authorization, applies_to: 업무와 회차, trigger: 읽기와 쓰기, logic: 유효한 가구 소속을 확인하고 다른 가구의 동일 ID를 읽거나 변경하지 않는다, violation: 403 또는 404, source: [FR1.3, FR2.2]}
  - {id: BR3.2, category: validation, applies_to: 업무 내용과 배정, trigger: 생성 및 수정, logic: 유효한 제목을 요구하고 원문과 작성자·요청자 및 담당자를 분리하며 가구 소속을 검증한다, violation: 422 또는 인가 오류, source: [FR2.1, FR2.4, FR2.8]}
  - {id: BR3.3, category: constraint, applies_to: 반복 규칙, trigger: 회차 계산, logic: 저장한 지역·시간대·정책을 사용하며 유효한 예정 회차만 고유 키로 만들고 종료일을 포함한다, violation: 불가능한 날짜는 건너뜀, source: [FR3.1, FR7.11, NFR4.1, NFR4.2]}
  - {id: BR3.4, category: policy, applies_to: 반복과 회차 편집, trigger: 범위 적용, logic: 선택 회차 또는 이후 또는 전체를 구분하며 과거 확정 상태와 해당 회차 ID 및 감사 이력을 유지한다, violation: 409 또는 422, source: [FR3.2]}
  - {id: BR3.5, category: policy, applies_to: 회차 진행, trigger: 시간 경과와 건너뛰기, logic: 반복 다음 시각에 앞선 PENDING만 놓침 처리하고 단발은 미완료 유지하며 반복의 현재 PENDING만 건너뛸 수 있다, violation: 허용되지 않은 전이는 409, source: [FR3.3, FR3.7]}
  - {id: BR3.6, category: policy, applies_to: 일반 완료, trigger: 완료나 완료 취소, logic: 검증을 사용하지 않는 회차의 완료와 취소는 승인된 가구 권한과 회차 revision을 검증하고 실제 행위자를 기록한다, violation: 거부 시 변경 없음, source: [FR2.3, FR2.7, FR2.9]}
  - {id: BR3.7, category: authorization, applies_to: 완료 검증, trigger: 설정 또는 응답, logic: 검증자는 담당자가 아닌 활성 가구 구성원이며 회차마다 현재 요청의 지정 검증자만 승인·거절할 수 있다, violation: 인가 실패 또는 충돌, source: [FR8.1, FR8.2, FR8.3]}
  - {id: BR3.8, category: policy, applies_to: 검증 대기, trigger: 제출과 철회 및 접근 회수, logic: 제출 시 검증 대기이며 응답 전 제출자 철회 및 검증자 소속 회수는 미완료로 되돌리고 이력을 보존한다, violation: 동시 변경은 한 건만 커밋, source: [FR8.1, FR8.2, FR8.3, FR1.9]}
  - {id: BR3.9, category: policy, applies_to: 보관, trigger: 보관 및 복원, logic: 보관 중 새 회차와 예약을 중지하고 이력을 유지하며 복원은 미래 회차부터 재개한다, violation: 기존 PENDING은 보존, source: [FR2.5, FR2.10, FR3.5, FR3.6]}
  - {id: BR3.10, category: constraint, applies_to: 삭제, trigger: 확인과 확정, logic: 명시적 확인과 운영 DB 및 독립 삭제 기록의 확정을 요구하며 다른 가구와 업무는 유지한다, violation: 미확정은 실패 또는 재시도, source: [FR2.6, FR10.7, NFR3.4]}
  - {id: BR3.11, category: policy, applies_to: 접근 회수와 무담당, trigger: 구성원 제거 또는 새 배정, logic: 실제 배정을 종료하고 예약 변경을 같은 쓰기에 묶으며 마지막 담당자 제거 후 미완료 회차와 공유 이력을 유지한다, violation: 효과 실패 시 롤백, source: [FR1.9, FR3.4]}
  - {id: BR3.12, category: validation, applies_to: 시간과 장소 Trigger, trigger: 조건 쓰기, logic: 조건은 상호 배타적이며 장소 반경·이벤트·지속 시간을 현재 가구 정책으로 검증한다, violation: 422 또는 정책 오류, source: [FR4, FR7.8, FR7.10]}
  - {id: BR3.13, category: policy, applies_to: 반경과 대상 계획, trigger: 정책이나 업무 변경, logic: 활성·보관 장소 조건을 경계에 맞추고 설치 후보 계획과 함께 원자적으로 반영하며 설치 용량 거부는 전체 중단한다, violation: 409 또는 503, source: [FR7.9, NFR3.1]}
  - {id: BR3.14, category: policy, applies_to: 활성 목록, trigger: 업무 조회, logic: 초기 내 할 일 보기와 요청자 및 가구 전체 보기는 인가된 currentOccurrence를 기존 버킷 및 안정 정렬로 보여준다, violation: 다른 가구 및 종료된 회차 제외, source: [FR5.1, FR5.2]}
  - {id: BR3.15, category: policy, applies_to: 이력과 보관함, trigger: 이력 또는 보관함 조회, logic: 상태를 축별로 분리하고 행위 시간 최신순의 이력과 보관순 보관함을 제공한다, violation: 가구 및 상태 필터를 항상 적용, source: [FR2.7, FR5.2]}
  - {id: BR3.16, category: policy, applies_to: 업무 화면, trigger: 표시 및 입력, logic: 반응형 조작과 접근 가능한 상태 문구를 제공하고 사용자 원문 및 locale과 IANA 표시 시간대를 분리한다, violation: API는 구조화 오류 사용, source: [FR6.3, FR7.4, FR7.5, NFR6, NFR7]}
  - {id: BR3.17, category: constraint, applies_to: 업무 저장과 피드, trigger: 변경 커밋, logic: 입력과 키와 revision을 연결하며 업무·감사·피드·서버 계획을 같은 쓰기에 저장하고 기기 반영은 이후 수행한다, violation: 경합·일시 오류를 구분, source: [NFR3.1, NFR3.2]}
  - {id: BR3.18, category: policy, applies_to: Reminder 범위 설정, trigger: 설정 조회와 변경, logic: Trigger와 반복 규칙 및 검증 설정은 해당 업무에 귀속하고 이전 일정의 시간대와 주간 기준을 보존한다, violation: 다른 범위로 복제 금지, source: [FR7.11, FR7.12]}
```

| 범위 | 규칙 |
| --- | --- |
| 권한·데이터·배정 | BR3.1, BR3.2, BR3.11 |
| 반복·회차·완료 | BR3.3~BR3.8 |
| 보관·삭제 | BR3.9~BR3.10 |
| 장소·설치·조회·설정 | BR3.12~BR3.18 |
