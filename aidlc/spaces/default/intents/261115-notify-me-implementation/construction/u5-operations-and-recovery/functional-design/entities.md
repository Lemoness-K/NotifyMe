# U5 운영·복구 엔티티

```yaml
entities:
  - name: BackupSnapshot
    description: 암호화된 일관 사본과 인증된 기준점
    attributes: [{name: snapshotId, type: opaque ID}, {name: schemaVersion, type: version}, {name: includedThrough, type: journal position}, {name: digest, type: hash}, {name: createdAt, type: UTC instant}]
    constraints: 사본 바이트와 기준점을 함께 인증하며 키는 별도 보관한다
    relationships: [{to: RecoveryRun, cardinality: "1:N"}]
  - name: BackupRun
    description: 백업 실행 결과
    attributes: [{name: runId, type: opaque ID}, {name: startedAt, type: UTC instant}, {name: outcome, values: [RUNNING, SUCCEEDED, FAILED]}, {name: errorCode, type: status code}]
    relationships: [{to: BackupSnapshot, cardinality: "1:0..1"}]
  - name: RecoveryRun
    description: 격리 복구 및 공개 재개 증거
    attributes: [{name: runId, type: opaque ID}, {name: recoverThrough, type: journal position}, {name: phase, values: [ISOLATED, VERIFIED, SERVING, BLOCKED]}, {name: candidateDigest, type: hash}, {name: newEpoch, type: opaque ID}]
    constraints: 증거는 검증한 후보와 종료 위치에만 유효하다
  - name: JournalAuthority
    description: 원장 사본과 독립적으로 확인하는 최신 이력 증거
    attributes: [{name: lineageId, type: opaque ID}, {name: position, type: journal position}, {name: historyDigest, type: authenticated digest}]
    constraints: 선택된 원장 백업에서 최신 증거를 유도하지 않는다
  - name: ServingActivation
    description: 재부팅에도 보존되는 공개 차단과 검증된 전환 정보
    attributes: [{name: recoveryRunId, type: opaque ID}, {name: databaseRef, type: protected path reference}, {name: epoch, type: opaque ID}, {name: phase, values: [BLOCKED, ACTIVE]}]
    constraints: 검증 완료와 DB 경로 및 서버 epoch는 한 상태에서 전환한다
  - name: LocalOperationsEvent
    description: 주간 운영 요약이나 장애 상태 변화
    attributes: [{name: eventId, type: opaque ID}, {name: kind, values: [WEEKLY, INCIDENT, RECOVERED, CHECK_FAILED]}, {name: at, type: UTC instant}, {name: outcome, type: status code}]
    constraints: 로컬 운영 전용이며 업무 내용과 자격 정보를 보존하지 않는다
```

삭제 원장 행의 소유자는 U3다. U5는 독립 원장의 신뢰 기준점과 종결 위치를 읽어 백업과 복원 증거로 사용한다.
