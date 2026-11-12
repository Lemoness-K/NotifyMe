# ADR-034: MVP 한국어·영어 UI 제공

- 상태: 승인됨
- 날짜: 2026-11-09
- 결정: `D-066`
- 관련 결정: `D-019`, `D-065`
- 관련 요구사항: `PR-AC-052`, `NFR-I18N-001`, `NFR-I18N-002`
- 관련 문서: [마스터 설계](../00-master-design.md), [제품 요구사항](../01-product-requirements.md), [설정 설계](../05-settings-and-feature-configuration.md), [시간대·지역화 설계](./ADR-033-time-zones-and-localization.md)

## 배경

사용자가 MVP에서 영어도 지원하기를 요청했다. 표시 언어는 가구 전체가 아니라 계정별로 선택해야 하며, 한국어·영어 문구와 locale별 형식을 제공해야 한다.

## 결정

- MVP UI 및 시스템 생성 문구는 한국어(`ko-KR`)와 영어(`en-US`)로 제공한다.
- 기본 언어는 한국어(`ko-KR`)이며, 각 사용자는 개인 설정에서 언어를 선택할 수 있다.
- 지원하지 않는 기기 locale은 기본 locale `ko-KR`로 fallback한다.
- 날짜·시간·숫자 등 표시는 선택한 locale과 User의 IANA time zone을 함께 따른다.
- 서버 API와 도메인 값은 locale-neutral하게 유지한다. 사용자가 작성한 Reminder 제목·내용은 자동 번역하지 않는다(`D-065`).

## 결과

- 같은 가구 구성원이 각자 다른 UI 언어를 사용해도 동일한 업무 데이터를 공유한다.
- 앱의 UI·시스템 문자열은 두 locale resource로 유지하고 추가 언어는 같은 구조에 확장한다.
- 번역 키 누락이나 잘못된 locale fallback이 사용자 흐름을 막지 않도록 검증한다.

## 구현 확인 사항

- MVP에서 `ko-KR`과 `en-US` 언어 선택기가 노출되고 사용자별 설정이 기기 간 동기화된다.
- 앱 재설치·새 기기 로그인 시 서버의 locale 설정을 복구하고, 저장된 locale이 없으면 `ko-KR`을 사용한다.
- API error code, enum, 시스템 알림 문구를 각 locale로 표현하되 사용자가 입력한 제목·내용은 바꾸지 않는다.
