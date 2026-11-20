# U4 설치 및 알림 데이터

```yaml
entities:
  - name: Installation
    description: 인증 계정에 연결된 앱 설치
    attributes: [{name: installationId, type: opaque ID, required: true, unique: true}, {name: userId, type: reference, required: true}, {name: credentialRef, type: protected reference}, {name: status, values: [ACTIVE, INACTIVE]}]
    constraints: 동일 설치의 토큰 갱신은 소유자를 바꾸지 않는다
    relationships: [{to: InstallationScope, cardinality: "1:N"}]
  - name: InstallationScope
    description: 설치와 가구의 인가 및 동기화 경계
    attributes: [{name: scopeRef, type: opaque ID}, {name: cursor, type: monotonic revision}, {name: desiredLocationCount, type: integer}, {name: locationCapacityState, values: [ACTIVE, CAPACITY_PENDING]}]
    constraints: 설치와 가구 조합은 유일하며 두 범위를 모두 확인한다
    relationships: [{to: SchedulePlan, cardinality: "1:N"}, {to: LocationExclusion, cardinality: "1:N"}, {to: ChangeSignal, cardinality: "1:N"}]
  - name: SchedulePlan
    description: 서버가 원하는 설치 예약
    attributes: [{name: planId, type: opaque ID}, {name: occurrenceId, type: reference}, {name: version, type: monotonic revision}, {name: kind, values: [TIME, LOCATION]}, {name: expiresAt, type: UTC instant}]
    constraints: 설치 범위와 계획 ID가 유일하며 한 회차에 한 종류만 존재한다
    relationships: [{to: DeviceState, cardinality: "1:0..1"}]
  - name: LocationExclusion
    description: 사용자가 선택한 설치 한정 장소 감지 제외
    attributes: [{name: reminderId, type: reference}, {name: scopeRef, type: reference}, {name: excluded, type: boolean}, {name: revision, type: monotonic revision}]
    constraints: 설치 범위와 업무 조합은 유일하며 재동기화에서 보존한다
  - name: ChangeSignal
    description: 커밋된 변경 또는 접근 회수의 전달 메타데이터
    attributes: [{name: eventId, type: opaque ID}, {name: scopeRef, type: reference}, {name: revision, type: monotonic revision}, {name: expiresAt, type: UTC instant}]
    constraints: 생성부터 24시간 이내에만 전달하며 업무 원문과 좌표를 넣지 않는다
  - name: DeviceState
    description: 적용 중인 계획과 기기 관측 상태
    attributes: [{name: planId, type: reference}, {name: appliedVersion, type: monotonic revision}, {name: platformId, type: opaque ID}, {name: desiredGeneration, type: monotonic revision}, {name: outcome, type: status}]
    constraints: 기기별 예약과 알림에 결정적인 ID를 사용한다
    relationships: [{to: ConditionEvent, cardinality: "1:N"}]
  - name: ConditionEvent
    description: 중복 제거된 장소 이벤트
    attributes: [{name: eventId, type: opaque ID}, {name: occurrenceId, type: reference}, {name: planVersion, type: monotonic revision}, {name: kind, values: [ENTER, EXIT, DWELL, AFTER_EXIT]}, {name: detectedAt, type: UTC instant}, {name: result, type: status}]
    constraints: 실시간 좌표나 이동 경로를 저장하지 않는다
    relationships: [{to: LocationTransitionState, cardinality: "N:1"}]
  - name: LocationTransitionState
    description: 설치 범위와 계획 버전별 마지막 인정 전이와 타이머
    attributes: [{name: lastState, values: [UNKNOWN, INSIDE, OUTSIDE]}, {name: transitionSequence, type: monotonic revision}, {name: timerKind, values: [DWELL, AFTER_EXIT]}, {name: deadline, type: UTC instant}, {name: elapsedDeadline, type: monotonic duration}, {name: bootRef, type: opaque ID}, {name: postingState, values: [READY, POSTED]}, {name: uploadState, values: [PENDING, ACKED]}]
    constraints: 다른 계획 버전과 시작 전이에 속한 타이머는 적용하지 않는다
```

설치와 가구를 함께 인가한다. 서버 계획과 기기의 적용 결과는 서로 다른 상태다. 설치 설정의 OS 권한은 조회한 상태이며 서버가 계정 설정으로 복제하지 않는다.
