# U4 Android 알림 업무 규칙

```yaml
rules:
  - {id: BR4.1, category: authorization, applies_to: 설치 등록, trigger: 해당 설치 처리, logic: 같은 계정의 세션과 설치 ID를 결합한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR1.4]}
  - {id: BR4.2, category: policy, applies_to: 대상 조회, trigger: 해당 설치 처리, logic: 현재 가구에 속한 활성 담당자의 설치만 계획 대상으로 확장한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.7]}
  - {id: BR4.3, category: constraint, applies_to: 용량, trigger: 해당 설치 처리, logic: 등록된 설치를 초과시키는 업무 변경과 설치 계획을 같은 쓰기에서 거부한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.8]}
  - {id: BR4.4, category: policy, applies_to: 신규 초과, trigger: 해당 설치 처리, logic: D-097에 따라 새 설치의 장소만 대기시키며 사용자 제외 후 다시 계산한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.8]}
  - {id: BR4.5, category: policy, applies_to: 변경 통지, trigger: 해당 설치 처리, logic: 커밋 이후 data-only 신호를 최대 24시간 유효하게 전달한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR6.2]}
  - {id: BR4.6, category: constraint, applies_to: 동기화, trigger: 해당 설치 처리, logic: 인가된 HTTPS FULL 또는 DELTA를 설치 세대와 revision으로 적용한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR6.1, NFR3.3]}
  - {id: BR4.7, category: authorization, applies_to: 제거, trigger: 해당 설치 처리, logic: 회수 및 삭제의 취소·정리는 늦은 응답이나 OS 콜백보다 우선한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR1.9, FR4.5]}
  - {id: BR4.8, category: policy, applies_to: 재조정, trigger: 해당 설치 처리, logic: 재시작·복구·시계·권한 변경 시 결정적 OS ID로 현재 계획을 회복한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR6.4]}
  - {id: BR4.9, category: policy, applies_to: 시간, trigger: 해당 설치 처리, logic: 저장된 일정을 사용해 24시간 창에서 한 번 표시하며 정확 권한 부재 시 지연을 안내한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.1]}
  - {id: BR4.10, category: policy, applies_to: 장소, trigger: 해당 설치 처리, logic: 새로운 전이와 타이머 이벤트를 중복 제거하고 즉시 로컬에서 표시한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.2]}
  - {id: BR4.11, category: constraint, applies_to: 위치 메타데이터, trigger: 해당 설치 처리, logic: 비좌표 이벤트 증거만 동기화하며 감지 시각부터 최대 30일 유지한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [NFR2.1]}
  - {id: BR4.12, category: policy, applies_to: 노출, trigger: 해당 설치 처리, logic: 시간·장소 채널을 구분하고 잠금 화면은 private 및 일반 공개 문구를 사용한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.3, FR4.4]}
  - {id: BR4.13, category: policy, applies_to: 설치 UI, trigger: 해당 설치 처리, logic: 권한 상태와 OS 설정을 제공하며 기본 업무 접근은 유지한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR4.6, FR6.3]}
  - {id: BR4.14, category: policy, applies_to: 현지화, trigger: 해당 설치 처리, logic: 기존 계정 locale 우선순위와 다국어 리소스 및 설치별 상태 분리를 적용한다, violation: 상태를 유지하고 제한 또는 실패를 안내한다, source: [FR7.2, NFR7]}
```

| 범위 | 규칙 |
| --- | --- |
| 등록·용량 | BR4.1~BR4.4 |
| 신호·동기화·재조정 | BR4.5~BR4.8 |
| 시간·장소 및 개인정보 | BR4.9~BR4.12 |
| 사용자 상태 | BR4.13~BR4.14 |
