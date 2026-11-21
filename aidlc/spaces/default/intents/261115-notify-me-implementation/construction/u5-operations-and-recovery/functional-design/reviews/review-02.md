## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T15:02:27Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 격리 복원 및 서비스 재개, 항목 1–2 | 신뢰할 수 있는 `recoverThrough`를 독립 원장에서 고정하지만, 복구 대상으로 읽는 원장이 마지막 삭제까지 포함한다는 외부 증거의 출처를 정하지 않았다. 기존 `src/server/delete-journal.ts`의 `open`은 원장 식별자와 현재 DB에서 확인되는 커밋을 대조하고 `hold.checkpoint`는 그 파일 자체의 최댓값을 읽는다. 원본 호스트를 잃은 뒤 같은 식별자의 더 오래된 복제본을 고르면 그 범위가 내부에서 연속이어도 뒤쪽의 확정 삭제가 누락될 수 있다. 복구용 원장과 선택한 스냅샷만으로 새 종료 위치를 신뢰하면 삭제된 업무를 다시 공개한다. | 복구 대상 파일과 독립적으로 보전된 종료점 증거의 소유자와 발행 조건을 정한다. 증거는 원장 식별자·계보, 마지막 신뢰 위치 및 내용 무결성을 묶어야 한다. 마지막 성공 삭제까지 보호할 수 없는 사본은 복구를 차단하고, 원본 호스트가 없을 때 동일 식별자의 누락된 꼬리와 변조 사본을 각각 거절하는 확인 절차를 추가한다. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 일관 백업과 보존, 항목 3–4, src/server/delete-journal.ts > prune 및 proofFloor | 보관본에 필요한 원장 위치를 먼저 지우지 않는다고 했지만, 기존 원장 정리는 백업의 존재와 무관하게 종결 시각만 보고 위치를 지운다. 백업은 게시 뒤 별도로 만료된다. 만료에 가까운 사본을 선택하는 동시에 다른 작업이 이미 `includedThrough` 이후 위치를 정리하면, 정상 후보에게 필요한 재적용 증거가 없어진다. | 가장 이른 복구 가능 기준점과 복구 중인 구간을 원장 정리의 입력으로 정의한다. 후보 게시·만료와 `proofFloor` 갱신 사이 경계를 정하고, 기준점이 보존 바닥 아래이거나 정리와 복구가 겹치면 후보를 거절한다. 백업과 기기 삭제 표지의 30일 상한 아래에서 후보 만료와 원장 정리의 순서를 검증한다. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 격리 복원 및 서비스 재개, 항목 1·3–4 및 aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/entities.md > RecoveryRun | 복구 상태와 후보 지문, 새 epoch를 저장하지만 자동 재시작·전원 중단에서 공개 상태를 차단하는 내구 조건이 없다. D-077의 systemd 자동 기동과 맞물리면, 중단 시점에 따라 검증된 후보로 DB 경로만 변경되거나 새 epoch만 반영된 조합으로 공개 프로세스가 기동할 수 있다. | 원본 쓰기·공개 차단이 재시작 뒤에도 유지되도록 한다. 검증된 후보 지문·종료점·데이터 경로·새 epoch를 같은 활성화 기록에 묶고 기동과 공개가 이를 검사하게 한다. 후보 검증과 경로 전환 사이, 전환과 공개 사이 각각의 중단 뒤 비검증 조합이 기동하지 않는지 확인한다. | Resolved (reviewer) |

> R-01 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md의 복구 경계와 `JournalAuthority`가 원장 사본에서 최신성을 유도하지 않으며 계보·단조 위치·인증된 누적 증거를 독립 저장한다. DB 변경 전에 REQUESTED를 독립 증거에 반영한다. DB 커밋 뒤 종결 저장을 잃어도 독립 증거에 남은 REQUESTED가 기준점과 공개를 차단한다. 이전 같은 계보의 사본, 다른 이력, 원본 호스트 유실 후 최신성 미확인을 각각 거절한다.

> R-02 Reviewer note: 백업의 게시·만료와 원장 정리가 같은 배타 경계에서 이뤄진다. 가장 이른 유효 기준점과 진행 중인 복구가 요구하는 위치를 보호하고, 30일 상한 충돌 시 후보를 먼저 사용 불가로 전환한다. 카탈로그와 정리 위치를 확인할 수 없으면 정리 및 후보 선택의 유효 범위를 점검한다.

> R-03 Reviewer note: `ServingActivation`은 작업 시작의 공개 차단을 재시작 후에도 유지한다. 초기 쓰기 전에 검증된 실행·후보 지문·경로·새 epoch를 같은 활성 전환에 묶고 systemd에서 혼합 상태를 거절한다. 정상 쓰기 이후 재시작은 활성 세대와 DB의 결합을 검사하도록 별도 처리한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage functional-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/traceability.json` | PASS. `findings_count: 0` | U5 수용 기준과 업무 규칙의 연결을 유지한다. |
| 공유 `recovery-delete-journal-v1` 및 변경 흐름 대조 | PASS. DB 변경 전 REQUESTED, 확정·실패 복구, 구 기준점과 재시작 경로 대조 | 독립 최신 증거는 복구 파일의 자체 무결성과 분리된다. 보존 보호, 격리 검증, 공개 전환도 각각 닫힌 실패 경계를 가진다. 저장 매체와 내구성 시험은 후속 설계·구현에서 구체화한다. |

### Summary

최신 원장 증거, 보존 순서, 재시작 후 공개 차단을 명시했다. 첫 검토에서 지적한 세 건은 기능 설계 수준에서 해결됐다.
