## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T08:20:27Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 설치 등록과 지오펜스 용량 | D-097 화면에 대기 상태와 필요 슬롯·한도, 페이지로 나눈 제외 후보가 필요하다. 공개 계약의 등록 응답에는 설치 ID·revision만, 동기화 응답에는 예약과 제거만 있으며 장소 제외에는 PUT만 있다. 화면을 구성하거나 용량 재계산 뒤 기존 제외를 읽을 수 있는 응답이 정의되지 않았다. | 설치 범위별 용량 상태를 반환하는 조회 응답과 좌표를 제외한 후보·현재 제외 여부·슬롯 수의 페이지 계약을 명시한다. 동일 계정의 설치 소유권과 활성 가구 소속을 권한·커서·제외 수정에서 같은 범위로 적용한다. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 1과 2 | 기기는 세대가 다른 응답을 버려야 하지만 공개 동기화 계약은 숫자 `afterRevision`과 응답의 `revision`만 갖는다. 복구에서 같은 숫자가 재사용될 경우 공백을 식별할 수 없고, 불투명 FCM `scopeRef`를 기존 설치·가구의 로컬 세대에 연결하는 계약도 없다. | 설치·가구·서버 세대와 revision을 묶은 커서와 scopeRef 전달·매핑 경계를 정의한다. 같은 세대에서만 revision을 비교하고 세대 불일치 시 현재 인가를 다시 검증해 FULL로 전환한다. 복구로 revision이 낮아진 경우와 이전 세대 응답이 나중에 오는 경우를 명시한다. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 4 | 회수 신호를 받았을 때의 동작은 있으나 누가 회수된 사용자의 설치를 추려 신호를 기록하는지 없다. U3 계획 포트가 활성 담당자의 설치만 찾고 계획 후보에 의존하면 이미 회수된 대상이나 예약 계획이 없던 설치의 가구 캐시에는 회수 신호가 등록되지 않는다. | 소속 회수 트랜잭션에서 이전 활성 설치 범위를 포착하고 계획 유무와 관계없이 해당 가구 접근 회수 신호를 기록한다. 설치·토큰 교체와 재가입의 세대 조건, 일반 네트워크 실패와 구별할 HTTPS 가구 접근 거절 응답, 늦은 적용을 억제하는 기기 잠금 경계를 명시한다. | Resolved (reviewer) |
| R-04 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/entities.md > DeviceState 및 ConditionEvent | 장소 알림은 연속 체류나 이탈 후 만료를 재현해야 하지만 DeviceState는 적용 버전·플랫폼 ID·세대·결과만 담고 있다. 앱 프로세스가 다시 생성되면 이전 경계 상태와 타이머 마감이 없어 같은 콜백의 재실행과 새로운 전이를 구분하거나 기존 타이머를 복구할 수 없다. | 설치·가구·계획 버전별 마지막 인정 위치 상태, 타이머 종류·마감·전이 식별자, 이벤트의 게시/업로드 상태를 지속 model과 연결한다. 재부팅과 시계 변경, 버전 교체 뒤 무효화, 이미 게시한 이벤트의 재실행 사례를 명시한다. | Unresolved |
| R-05 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수 > 항목 2와 3 | 새 epoch의 FULL은 새 `scopeRef`를 받지만 기존 네이티브 `reconcile`은 호출에 지정된 `scopeRef`만 받는다. 이전 범위를 전달하거나 명시적으로 제거하지 않으면 새 범위가 적용돼도 이전 범위의 알람과 지오펜스가 남을 수 있다. | 인가된 세대 전환에서 이전 범위를 먼저 잠그고 이전 `scopeRef`의 예약·타이머를 제거한 후 새 FULL을 적용하도록 정의한다. 제거 중 프로세스가 종료되어도 같은 전환을 재개하고 이전 콜백을 차단할 방법을 명시한다. | Unresolved |
| R-06 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md > 동기화와 접근 회수, 항목 6 | 강제 종료와 일반 재생성을 OS 증거로 구분한다는 문장만으로 시작 경로를 결정할 수 없다. 지원 범위는 API 24부터이고 `ApplicationStartInfo.wasForceStopped()`는 API 35부터다. API 30 이후의 `REASON_USER_REQUESTED`도 강제 종료와 최근 앱 목록 제거를 같은 이유로 보고할 수 있다. Android 15는 앱이 강제 종료 상태에서 풀릴 때에도 `BOOT_COMPLETED`를 보낸다. 구형·증거 누락·해석이 모호한 시작을 모두 일반 복귀로 보면 D-050의 인가 확인을 건너뛸 수 있고, 모두 강제 종료로 보면 인터넷 장애 중 이미 등록된 정상 알림까지 멈춘다. [시작 기록 API](https://developer.android.com/reference/android/app/ApplicationStartInfo#wasForceStopped()) [종료 이유 API](https://developer.android.com/reference/android/app/ApplicationExitInfo#REASON_USER_REQUESTED) [Android 15 패키지 중지 동작](https://developer.android.com/about/versions/15/behavior-changes-all#package-stopped-state) | 확인된 강제 종료·일반 복귀·증거 불명확, 실제 부팅과 패키지 중지 해제 신호를 구분하는 결정표를 작성한다. 범위·부팅·등록 근거로 확인되는 기존 콜백의 처리, 불명확한 상태에서 캐시 게시·새 등록 전 FULL 요구 여부와 연결 실패·회수 시 동작을 각각 정의하고 지원 API별 검증 사례를 붙인다. | New |

> R-04 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/entities.md의 `LocationTransitionState`에 마지막 경계·전이 번호·부팅 및 두 종류의 마감은 추가됐다. 그러나 여러 `ConditionEvent`가 하나의 전이 상태를 참조하는데 게시·업로드 상태는 그 전이 상태에 놓인다. 앞의 이벤트가 게시됐지만 업로드 대기 중이고 다음 이벤트는 게시 전인 상태를 동시에 복구할 수 없다. 새 시간 및 장소 알림 6항의 등록 식별자도 지속 모델에 없다. 이벤트별 게시·업로드 및 OS 게시 ID, 위치 전이의 설치 범위·계획 버전·부팅·등록 세대를 연결하고 각 상태의 무효화 범위를 명시한다.

> R-05 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/functional-design/functional-spec.md의 동기화 2·3·6항은 새 FULL과 늦은 응답의 우선순위를 정한다. aidlc/spaces/default/intents/261115-notify-me-implementation/inception/contract-design/contract-summary.md의 `NativeSchedulePort`는 `scopeRef`별 호출을 제공한다. 이전 scopeRef를 어떤 지속 상태에 잠그고 언제 취소·정리하며, 새 인가를 언제 다시 확인하는지는 연결하지 않았다. 정리 중 프로세스 종료 직후에는 이전 예약 처리와 새 FULL 적용 순서가 구현마다 달라진다. 이전 scopeRef·epoch와 정리 대상 ID를 저장하고 콜백을 먼저 막은 뒤, 중단된 정리를 재개하고 최신 인가 FULL을 적용하는 상태 전이를 정의한다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 읽기 전용 추적표·업무 규칙 대조 | PASS. 수용 기준 58개, 추적 행 58개, 업무 규칙 14개. 누락이나 해석되지 않는 OK 규칙 식별자 0건 | 변경된 동기화·재조정·시간·장소 규칙은 배정된 제품 요구 범위를 유지한다. |
| 공유 OpenAPI JSON 파싱 및 필수 필드 비교 | PASS. 23개 경로 파싱. `SyncSnapshot`은 epoch와 scopeRef를, `DeviceEvent`는 epoch와 eventId를 요구한다. | 서버 동기화·이벤트 형식은 세대를 표현한다. 기기 모델과 범위 교체 순서의 공백은 HTTP 형식으로 해결되지 않는다. |
| Android 공개 API, ADR-018과 설계 시작 경로 대조 | 보완 필요. 지원 API별 증거와 증거 부재 시 대기·복귀 순서가 불명확하다. | 설계의 세 가지 보완 방향은 FR4.2·FR4.5·FR6.4와 D-050에 부합한다. 버전별 결정과 지속 모델 확인이 필요하다. |

### Summary

일반 오프라인 복귀와 강제 종료의 차이, 위치 감지 무효화 우선순위, 같은 부팅의 정상 재생성에 필요한 방향을 반영했다. 지원 Android에서 시작을 구분하는 기준과 지속 모델, 중단 후 복구 가능한 이전 범위 정리 순서를 보완해야 한다.
