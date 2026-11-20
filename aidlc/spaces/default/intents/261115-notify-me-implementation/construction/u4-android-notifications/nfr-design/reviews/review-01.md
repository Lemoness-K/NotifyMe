## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-19T11:04:45Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/security-design.md > Design > NFR1.1.4 | Credential Manager의 서버 challenge와 기존 U1 세션 발급을 연결하지만 공통 계약에는 nonce 발급·소비나 Google 증명과 Firebase Bearer를 함께 검증할 경로가 없다. Firebase 교환과 서버의 Google nonce 검증은 각각 어떤 증거를 사용하는지 명시해야 한다. | 첫 로그인에서 challenge를 발급할 경로, 유효 기간·일회 소비, Google 증명과 Firebase 신원의 결합 및 기존 U1 세션을 발급하는 응답을 정의한다. 인증 전 접근과 갱신·로그아웃을 구분하고 웹 기존 경로의 회귀를 확인한다. [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation), [Firebase Android 인증](https://firebase.google.com/docs/auth/android/google-signin) | New |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md > Design > NFR3.3.4 | 이전 예약 제거와 전환의 재실행은 정의됐지만 그 사이 도착한 새 범위 회수나 업데이트로 저장된 대기 FULL을 무효화하는 경로가 없다. 제거에 시간이나 재부팅이 걸리면 이미 회수되거나 더 이상 최신이 아닌 계획을 뒤늦게 설치할 수 있다. | 새 범위 적용 직전에 현재 계정·가구 권한과 최신 세대·revision을 다시 확인한다. 회수와 로그아웃은 대기 FULL도 폐기하고, 정리 중 더 최신 신호가 왔을 때 최신 FULL을 다시 얻도록 한다. 작업 중단·재실행 시험에 이 두 경합을 포함한다. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/logical-components.md > Design > 자동 검증 | ARM64 TS/JVM, x64 SDK 조립, 두 실기기 동작은 분리됐지만 실기기별 OS·권한·설치 빌드와 기대 결과를 남기는 항목이 없다. 설치 성공만 확인했을 때 일부 실동작을 검증한 것으로 오해할 수 있다. | 각 실기기의 OS·기기·빌드와 시나리오별 기대 결과, 관찰 증거·미실행 상태를 기록하도록 합격표를 연결한다. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/reliability-design.md > Design > NFR3.1.4 및 NFR3.3.4 | 커밋 뒤 단일 처리자가 FCM을 보낸다고 하나 전송 결과 저장 전 중단, 일시 실패 재시도와 만료 처리의 기준이 구체화되지 않았다. | lease와 재시도 시각, 제공자 수락·영구 실패·만료 상태를 지정한다. 재시작 뒤 같은 이벤트 ID와 남은 TTL을 재사용하고 24시간 이후에는 보내지 않는지 검증한다. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc engine sensor-traceability --stage nfr-design --output-path aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u4-android-notifications/nfr-design/traceability.json` | PASS (`findings_count: 0`) | 상위 요구사항과 설계의 연결을 확인했다. |

### Summary

위치 이벤트별 게시·업로드 상태, 이전 범위 정리의 재개, 지오펜스 한도 시나리오와 기기 검증 단계가 구체화됐다. 네이티브 로그인 계약과 정리 도중 무효화된 계획의 적용 차단을 추가해야 한다.
