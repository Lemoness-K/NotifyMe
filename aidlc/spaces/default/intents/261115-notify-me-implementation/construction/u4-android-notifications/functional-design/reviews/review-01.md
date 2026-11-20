## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-19T10:56:25Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 설치 등록과 지오펜스 용량 | D-097 화면에 대기 상태와 필요 슬롯·한도, 페이지로 나눈 제외 후보가 필요하다. 공개 계약의 등록 응답에는 설치 ID·revision만, 동기화 응답에는 예약과 제거만 있으며 장소 제외에는 PUT만 있다. 화면을 구성하거나 용량 재계산 뒤 기존 제외를 읽을 수 있는 응답이 정의되지 않았다. | 설치 범위별 용량 상태를 반환하는 조회 응답과 좌표를 제외한 후보·현재 제외 여부·슬롯 수의 페이지 계약을 명시한다. 동일 계정의 설치 소유권과 활성 가구 소속을 권한·커서·제외 수정에서 같은 범위로 적용한다. | New |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 1과 2 | 기기는 세대가 다른 응답을 버려야 하지만 공개 동기화 계약은 숫자 `afterRevision`과 응답의 `revision`만 갖는다. 복구에서 같은 숫자가 재사용될 경우 공백을 식별할 수 없고, 불투명 FCM `scopeRef`를 기존 설치·가구의 로컬 세대에 연결하는 계약도 없다. | 설치·가구·서버 세대와 revision을 묶은 커서와 scopeRef 전달·매핑 경계를 정의한다. 같은 세대에서만 revision을 비교하고 세대 불일치 시 현재 인가를 다시 검증해 FULL로 전환한다. 복구로 revision이 낮아진 경우와 이전 세대 응답이 나중에 오는 경우를 명시한다. | New |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 4 | 회수 신호를 받았을 때의 동작은 있으나 누가 회수된 사용자의 설치를 추려 신호를 기록하는지 없다. U3 계획 포트가 활성 담당자의 설치만 찾고 계획 후보에 의존하면 이미 회수된 대상이나 예약 계획이 없던 설치의 가구 캐시에는 회수 신호가 등록되지 않는다. | 소속 회수 트랜잭션에서 이전 활성 설치 범위를 포착하고 계획 유무와 관계없이 해당 가구 접근 회수 신호를 기록한다. 설치·토큰 교체와 재가입의 세대 조건, 일반 네트워크 실패와 구별할 HTTPS 가구 접근 거절 응답, 늦은 적용을 억제하는 기기 잠금 경계를 명시한다. | New |
| R-04 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/entities.md > DeviceState 및 ConditionEvent | 장소 알림은 연속 체류나 이탈 후 만료를 재현해야 하지만 DeviceState는 적용 버전·플랫폼 ID·세대·결과만 담고 있다. 앱 프로세스가 다시 생성되면 이전 경계 상태와 타이머 마감이 없어 같은 콜백의 재실행과 새로운 전이를 구분하거나 기존 타이머를 복구할 수 없다. | 설치·가구·계획 버전별 마지막 인정 위치 상태, 타이머 종류·마감·전이 식별자, 이벤트의 게시/업로드 상태를 지속 model과 연결한다. 재부팅과 시계 변경, 버전 교체 뒤 무효화, 이미 게시한 이벤트의 재실행 사례를 명시한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage functional-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/traceability.json` | PASS (`findings_count: 0`) | 센서가 확인한 상위 요구사항 연결은 통과했다. 승인 계약, 기존 U3 포트 및 상태 모델은 직접 대조했다. |

### Summary

새 설치의 장소 감지만 대기시키고 시간 알림과 다른 설치를 유지하는 D-097 동작은 반영됐다. 화면 조회 계약, 복구 시 설치 세대, 접근 회수 발신 경로, 재실행할 수 있는 장소 상태를 구체화해야 한다.
