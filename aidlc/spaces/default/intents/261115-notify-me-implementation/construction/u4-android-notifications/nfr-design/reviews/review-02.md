## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-20T08:26:48Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/security-design.md > Design > NFR1.1.4 | Credential Manager의 서버 challenge와 기존 U1 세션 발급을 연결하지만 공통 계약에는 nonce 발급·소비나 Google 증명과 Firebase Bearer를 함께 검증할 경로가 없다. Firebase 교환과 서버의 Google nonce 검증은 각각 어떤 증거를 사용하는지 명시해야 한다. | 첫 로그인에서 challenge를 발급할 경로, 유효 기간·일회 소비, Google 증명과 Firebase 신원의 결합 및 기존 U1 세션을 발급하는 응답을 정의한다. 인증 전 접근과 갱신·로그아웃을 구분하고 웹 기존 경로의 회귀를 확인한다. [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [Firebase Android 인증](https://firebase.google.com/docs/auth/android/google-signin) | Unresolved |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md > Design > NFR3.3.4 | 이전 예약 제거와 전환의 재실행은 정의됐지만 그 사이 도착한 새 범위 회수나 업데이트로 저장된 대기 FULL을 무효화하는 경로가 없다. 제거에 시간이나 재부팅이 걸리면 이미 회수되거나 더 이상 최신이 아닌 계획을 뒤늦게 설치할 수 있다. | 새 범위 적용 직전에 현재 계정·가구 권한과 최신 세대·revision을 다시 확인한다. 회수와 로그아웃은 대기 FULL도 폐기하고, 정리 중 더 최신 신호가 왔을 때 최신 FULL을 다시 얻도록 한다. 작업 중단·재실행 시험에 이 두 경합을 포함한다. | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/logical-components.md > Design > 자동 검증 | ARM64 TS/JVM, x64 SDK 조립, 두 실기기 동작은 분리됐지만 실기기별 OS·권한·설치 빌드와 기대 결과를 남기는 항목이 없다. 설치 성공만 확인했을 때 일부 실동작을 검증한 것으로 오해할 수 있다. | 각 실기기의 OS·기기·빌드와 시나리오별 기대 결과, 관찰 증거·미실행 상태를 기록하도록 합격표를 연결한다. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md > Design > NFR3.1.4 및 NFR3.3.4 | 커밋 뒤 단일 처리자가 FCM을 보낸다고 하나 전송 결과 저장 전 중단, 일시 실패 재시도와 만료 처리의 기준이 구체화되지 않았다. | lease와 재시도 시각, 제공자 수락·영구 실패·만료 상태를 지정한다. 재시작 뒤 같은 이벤트 ID와 남은 TTL을 재사용하고 24시간 이후에는 보내지 않는지 검증한다. | Unresolved |

> R-01 Reviewer note: 공유 OpenAPI에 `POST /sessions/challenges`와 `POST /sessions`가 생겼다. 발급과 일회 소비, Google 증명과 Firebase Bearer의 결합, 보호된 세션 쿠키 및 오류 응답을 정의해 기존 경로 공백을 해소했다. Challenge 수명은 `Short-lived`만 표기해 유효 기간 및 만료 검증의 기존 U1 기준을 가리키는 명시적 연결이 남아 있다.

> R-02 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md의 새 절은 이전 수신을 차단하고 정리한 후 현재 FULL을 다시 확인하도록 개선했다. 동기화 중 받은 새 범위의 회수·로그아웃에서 지속 저장된 대기 계획까지 폐기하는 조건과, 새 revision이 도착하는 동안 정리를 재개해 현재 FULL만 적용하는 경합 시험은 남아 있다.

> R-03 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/logical-components.md는 ARM64·x64와 실기기를 구분하고 실기기 시나리오를 나열한다. 기기별 OS·빌드, 합격 조건·증거·미실행을 연결하는 인수 검증표는 없다.

> R-04 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md는 원자 저장, 단일 발행자와 24시간 NFR을 참조한다. 처리 lease, 재시작 뒤 재발행 판단, 수락과 영구 실패의 종결 상태, 남은 수명 전달을 한 시퀀스로 연결하지 않았다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage nfr-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/traceability.json` | PASS. `findings_count: 0` | U4 세부 NFR과 설계 링크를 검증했다. |
| 시작 분류와 콜백 우선순위 대조 | PASS. 새 네 가지 실행 분기 및 NFR3.2.4·NFR3.3.4 비교 | 위치 중단은 대기 작업보다 앞서 잠근다. 동일 부팅의 일반 재생성은 유효한 등록을 복구하며, 일반 화면 복귀와 강제 종료·증거 불명확한 콜드 진입의 FULL 확인을 구분한다. 패키지 정지 해제의 부팅 재전달이 이 잠금을 풀지 않는다. |
| 공통 인증 계약 대조 | 새 API 경로와 결합 증거 확인. 수명 기준 링크는 남아 있다. | 브라우저와 Android가 같은 일회 소비 흐름을 사용한다. |

### Summary

새 콜백·인가 설계는 일반 복귀, 콜드 진입, 위치 감지 중단을 실행 순서로 구분한다. 이전 범위 정리 중 대기 계획의 명시적 폐기와 경합 검증 등 기존 후속 사항은 유지한다.
