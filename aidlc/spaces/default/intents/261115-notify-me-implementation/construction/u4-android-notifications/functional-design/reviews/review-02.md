## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-19T10:59:35Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 설치 등록과 지오펜스 용량 | D-097 화면에 대기 상태와 필요 슬롯·한도, 페이지로 나눈 제외 후보가 필요하다. 공개 계약의 등록 응답에는 설치 ID·revision만, 동기화 응답에는 예약과 제거만 있으며 장소 제외에는 PUT만 있다. 화면을 구성하거나 용량 재계산 뒤 기존 제외를 읽을 수 있는 응답이 정의되지 않았다. | 설치 범위별 용량 상태를 반환하는 조회 응답과 좌표를 제외한 후보·현재 제외 여부·슬롯 수의 페이지 계약을 명시한다. 동일 계정의 설치 소유권과 활성 가구 소속을 권한·커서·제외 수정에서 같은 범위로 적용한다. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 1과 2 | 기기는 세대가 다른 응답을 버려야 하지만 공개 동기화 계약은 숫자 `afterRevision`과 응답의 `revision`만 갖는다. 복구에서 같은 숫자가 재사용될 경우 공백을 식별할 수 없고, 불투명 FCM `scopeRef`를 기존 설치·가구의 로컬 세대에 연결하는 계약도 없다. | 설치·가구·서버 세대와 revision을 묶은 커서와 scopeRef 전달·매핑 경계를 정의한다. 같은 세대에서만 revision을 비교하고 세대 불일치 시 현재 인가를 다시 검증해 FULL로 전환한다. 복구로 revision이 낮아진 경우와 이전 세대 응답이 나중에 오는 경우를 명시한다. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 4 | 회수 신호를 받았을 때의 동작은 있으나 누가 회수된 사용자의 설치를 추려 신호를 기록하는지 없다. U3 계획 포트가 활성 담당자의 설치만 찾고 계획 후보에 의존하면 이미 회수된 대상이나 예약 계획이 없던 설치의 가구 캐시에는 회수 신호가 등록되지 않는다. | 소속 회수 트랜잭션에서 이전 활성 설치 범위를 포착하고 계획 유무와 관계없이 해당 가구 접근 회수 신호를 기록한다. 설치·토큰 교체와 재가입의 세대 조건, 일반 네트워크 실패와 구별할 HTTPS 가구 접근 거절 응답, 늦은 적용을 억제하는 기기 잠금 경계를 명시한다. | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/entities.md > DeviceState 및 ConditionEvent | 장소 알림은 연속 체류나 이탈 후 만료를 재현해야 하지만 DeviceState는 적용 버전·플랫폼 ID·세대·결과만 담고 있다. 앱 프로세스가 다시 생성되면 이전 경계 상태와 타이머 마감이 없어 같은 콜백의 재실행과 새로운 전이를 구분하거나 기존 타이머를 복구할 수 없다. | 설치·가구·계획 버전별 마지막 인정 위치 상태, 타이머 종류·마감·전이 식별자, 이벤트의 게시/업로드 상태를 지속 model과 연결한다. 재부팅과 시계 변경, 버전 교체 뒤 무효화, 이미 게시한 이벤트의 재실행 사례를 명시한다. | Unresolved |
| R-05 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 2와 3 | 새 epoch의 FULL은 새 `scopeRef`를 받지만 기존 네이티브 `reconcile`은 호출에 지정된 `scopeRef`만 받는다. 이전 범위를 전달하거나 명시적으로 제거하지 않으면 새 범위가 적용돼도 이전 범위의 알람과 지오펜스가 남을 수 있다. | 인가된 세대 전환에서 이전 범위를 먼저 잠그고 이전 `scopeRef`의 예약·타이머를 제거한 후 새 FULL을 적용하도록 정의한다. 제거 중 프로세스가 종료되어도 같은 전환을 재개하고 이전 콜백을 차단할 방법을 명시한다. | New |

> R-01 Reviewer note: 설치별 용량 상태가 동기화 응답에 추가됐다. 전용 GET이 좌표 없는 제외 후보, 현재 제외 여부와 슬롯 수를 반환하며 커서와 변경이 같은 권한 범위와 세대·revision을 사용한다.

> R-02 Reviewer note: `afterEpoch`/revision 및 응답의 `epoch`/`scopeRef`가 계약에 추가됐다. 복구 뒤 새 epoch의 낮은 revision을 인가된 FULL로 받고 이전 응답을 폐기한다. 네이티브 예약 교체 경계는 아래에 별도로 기록했다.

> R-03 Reviewer note: 소속 회수 트랜잭션이 기존 설치 범위를 포착하고 예약이 없는 설치에도 회수 신호를 기록한다. 토큰·재가입 세대와 `HOUSEHOLD_ACCESS_REVOKED`에 따른 로컬 잠금과 제거도 정의됐다.

> R-04 Reviewer note: 위치 상태, 전이 번호, 타이머 마감과 부팅 세대는 반영됐다. 다만 게시·업로드 상태가 개별 `ConditionEvent`가 아닌 여러 이벤트가 공유하는 `LocationTransitionState`에 있다. 오프라인에서 같은 계획의 이벤트가 둘 이상 쌓이면 하나만 게시됐거나 하나만 서버 확인을 받았을 때 상태를 따로 유지할 수 없다. `eventId`마다 게시 상태, 플랫폼 알림 ID와 업로드 확인 상태를 저장하고 같은 계획의 복수 대기 이벤트를 검증한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage functional-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/traceability.json` | PASS (`findings_count: 0`) | 추적성 검사를 통과했다. |
| Python 표준 라이브러리 OpenAPI JSON 파싱 | PASS, 1개 블록 | 설치 위치 관리 경로와 수정된 동기화 계약을 확인했다. |

### Summary

설치별 용량 관리와 회수 신호 계약이 구체화됐다. 여러 장소 이벤트의 독립 처리 상태와 서버 세대 전환 시 기존 네이티브 예약의 제거가 남아 있다.
