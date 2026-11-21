## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T14:59:15Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 격리 복원 및 서비스 재개, 항목 1–2 | 신뢰할 수 있는 `recoverThrough`를 독립 원장에서 고정하지만, 복구 대상으로 읽는 원장이 마지막 삭제까지 포함한다는 외부 증거의 출처를 정하지 않았다. 기존 `src/server/delete-journal.ts`의 `open`은 원장 식별자와 현재 DB에서 확인되는 커밋을 대조하고 `hold.checkpoint`는 그 파일 자체의 최댓값을 읽는다. 원본 호스트를 잃은 뒤 같은 식별자의 더 오래된 복제본을 고르면 그 범위가 내부에서 연속이어도 뒤쪽의 확정 삭제가 누락될 수 있다. 복구용 원장과 선택한 스냅샷만으로 새 종료 위치를 신뢰하면 삭제된 업무를 다시 공개한다. | 복구 대상 파일과 독립적으로 보전된 종료점 증거의 소유자와 발행 조건을 정한다. 증거는 원장 식별자·계보, 마지막 신뢰 위치 및 내용 무결성을 묶어야 한다. 마지막 성공 삭제까지 보호할 수 없는 사본은 복구를 차단하고, 원본 호스트가 없을 때 동일 식별자의 누락된 꼬리와 변조 사본을 각각 거절하는 확인 절차를 추가한다. | New |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 일관 백업과 보존, 항목 3–4, src/server/delete-journal.ts > prune 및 proofFloor | 보관본에 필요한 원장 위치를 먼저 지우지 않는다고 했지만, 기존 원장 정리는 백업의 존재와 무관하게 종결 시각만 보고 위치를 지운다. 백업은 게시 뒤 별도로 만료된다. 만료에 가까운 사본을 선택하는 동시에 다른 작업이 이미 `includedThrough` 이후 위치를 정리하면, 정상 후보에게 필요한 재적용 증거가 없어진다. | 가장 이른 복구 가능 기준점과 복구 중인 구간을 원장 정리의 입력으로 정의한다. 후보 게시·만료와 `proofFloor` 갱신 사이 경계를 정하고, 기준점이 보존 바닥 아래이거나 정리와 복구가 겹치면 후보를 거절한다. 백업과 기기 삭제 표지의 30일 상한 아래에서 후보 만료와 원장 정리의 순서를 검증한다. | New |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/functional-spec.md > 격리 복원 및 서비스 재개, 항목 1·3–4 및 aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/entities.md > RecoveryRun | 복구 상태와 후보 지문, 새 epoch를 저장하지만 자동 재시작·전원 중단에서 공개 상태를 차단하는 내구 조건이 없다. D-077의 systemd 자동 기동과 맞물리면, 중단 시점에 따라 검증된 후보로 DB 경로만 변경되거나 새 epoch만 반영된 조합으로 공개 프로세스가 기동할 수 있다. | 원본 쓰기·공개 차단이 재시작 뒤에도 유지되도록 한다. 검증된 후보 지문·종료점·데이터 경로·새 epoch를 같은 활성화 기록에 묶고 기동과 공개가 이를 검사하게 한다. 후보 검증과 경로 전환 사이, 전환과 공개 사이 각각의 중단 뒤 비검증 조합이 기동하지 않는지 확인한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage functional-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u5-operations-and-recovery/functional-design/traceability.json` | PASS. `findings_count: 0` | 배정된 수용 기준에서 U5 행동 규칙으로의 연결을 확인했다. |
| `recovery-delete-journal-v1`, 기존 원장 인터페이스 및 U5 흐름 대조 | 설계 보완 필요 | U3의 첫 권한 거절과 재시도는 구분했고, U4 설치 정리로 원장 조정이 지나쳐지지 않게 했다. 종료점의 독립 증거와 보존·재시작 경계가 추가로 필요하다. |
| Q-070 답변 및 D-098과 로컬 진단 대조 | PASS | 주간 요약과 감지 즉시 남기는 로컬 기록을 별도로 제어한다. 새 외부 사업자나 호스트 외부 수신은 현재 흐름에 포함하지 않는다. |

### Summary

일관 사본, 격리 복원, 확정 삭제 재적용의 순서가 정해졌다. 오래된 원장의 끝을 신뢰해 삭제를 놓치는 경우와, 원장 정리·서비스 재시작에서 검증 범위가 바뀌는 경우를 막는 내구 경계가 필요하다.
