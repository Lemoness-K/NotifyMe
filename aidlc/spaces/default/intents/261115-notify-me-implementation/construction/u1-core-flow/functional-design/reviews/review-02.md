## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-18T06:37:33Z
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/functional-design/functional-spec.md > Workflows 2 및 인터페이스와 화면 | 보호 요청에서 외부 토큰과 앱 세션을 함께 확인한다. 승인된 API에는 Firebase Bearer 인증만 있고, 상세 설계는 앱 세션을 발급하고 요청에 연결하는 방법을 DS-003으로 넘긴다. 같은 사용자의 두 설치 중 현재 설치만 종료하고 로그아웃한 세션의 접근을 막는 흐름을 현재 문서만으로 구현할 수 없다. | 세션 발급 및 보호 요청·현재 세션 로그아웃에 필요한 세션 전달과 검증 조건을 명시한다. 승인된 API에 필요한 수정은 함께 정리하고, 두 세션을 연 뒤 하나만 종료하는 검증을 추가한다. | Unresolved |
| R-02 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/functional-design/rules.md > BR2.1 등록 | 입력으로 받은 담당자는 활성 가구원인지 검증하지만 요청자에는 기본값만 정의했다. API는 사용자가 요청자를 지정할 수 있고, 모델의 요청자 필드는 내부 사용자 참조만 요구한다. 이대로 구현하면 다른 가구 사용자나 비활성 소속을 요청자로 연결할 수 있다. | 명시적 요청자도 현재 가구의 활성 구성원인지 서버에서 검증한다. 다른 가구·비활성 요청자는 저장 없이 거부하고, 유효한 동일 가구 요청자와 필드 생략 시 현재 사용자 기본값을 각각 검증한다. | Resolved (reviewer) |
| R-03 | Major | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/functional-design/functional-spec.md > Workflows 3 및 인터페이스와 화면 | 시간 리마인더가 첫 통합 시연의 대상이지만, 입력한 현지 시각을 매핑하는 기준과 서머타임 전환 처리, 잘못된 시간대의 오류 조건이 없다. 저장 모델은 UTC 시각과 지역 시간대를 요구하고 상위 품질 요건에는 건너뛴 시각과 두 번 나타나는 시각의 처리 규칙이 있다. 변환을 각 클라이언트가 다르게 구현하면 같은 입력이 다른 시각으로 저장될 수 있다. | 승인된 가구 기본 시간대와 UTC 변환 책임을 등록 흐름에 연결하고, 건너뛴 시각·중복 시각의 승인 규칙, 잘못된 시간대 응답, 저장 후 시간대 변경이 기존 일정을 옮기지 않는다는 검증 조건을 명시한다. | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/functional-design/traceability.json > AC1.6.1, AC4.6.1, AC6.3.1 | 읽기·등록을 설계한 U1의 규칙으로 공유 수정·완료, Android 연동, 전체 UI 번역 자원까지 덮는다는 인상을 준다. 배정표는 이 스토리의 구현을 다른 단위와 나눴다. | 추적표 또는 규칙의 대응 설명에 U1에서 확인하는 부분과 다른 단위가 확인할 부분을 각각 표시한다. | Resolved (reviewer) |

> R-01 Reviewer note: aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u1-core-flow/functional-design/functional-spec.md의 인터페이스와 화면에 발급·쿠키 검증·현재 세션만 종료하는 흐름 및 두 세션 격리 검증이 추가됐다. 다만 이미 로그아웃한 설치에서 새 로그인 없이 세션을 다시 발급받지 못하게 하는 조건은 명시되지 않았다. 새 인증 여부를 판단하는 발급 조건과 검증 사례를 계약 변경에 포함해야 AC1.1.3을 확인할 수 있다.

> R-02 Reviewer note: BR2.1과 등록 검증에 명시적으로 지정한 요청자의 같은 가구 활성 소속 확인과 다른 가구·비활성 요청자의 저장 없는 거부가 추가됐다.

> R-03 Reviewer note: 공용 UI의 현지 시각 해석 책임, DST 간격과 겹침 처리의 기준, 서버의 시각·시간대 검증 및 기존 일정 보존 기준이 추가됐다.

> R-04 Reviewer note: 공유 수용 기준 표에 U1 검증 범위와 U2~U4의 연계 책임이 구분돼 있다.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 기능 설계 추적성 검사 | PASS | 누락, 고아 규칙과 잘못된 대상이 없다. |

### Summary

등록, 시간 처리, 단위 간 검증 범위가 구체화됐다. 계약을 보완할 때는 로그아웃한 설치에서 다시 로그인하기 전까지 앱 세션도 다시 발급되지 않는 조건을 명시해야 한다.
