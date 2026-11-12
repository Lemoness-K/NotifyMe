# ADR-033: 시간대와 다국어 지원 경계

- 상태: 승인됨
- 날짜: 2026-11-09
- 결정: `D-065`
- 관련 결정: `D-018`, `D-019`, `D-022`, `D-064`, `D-066`
- 관련 요구사항: `PR-AC-051`, `PR-AC-052`, `NFR-TIME-001`~`NFR-TIME-004`, `NFR-I18N-001`~`NFR-I18N-002`
- 관련 문서: [마스터 설계](../00-master-design.md), [제품 요구사항](../01-product-requirements.md), [도메인·데이터 설계](../02-domain-and-data-design.md), [시스템 아키텍처](../03-system-architecture.md), [설정 설계](../05-settings-and-feature-configuration.md)

## 배경

Reminder는 한 household의 구성원이 함께 보므로 사용자의 표시 시간대와 일정 자체의 실행 시간대를 분리해야 한다. 한국어 외 언어를 나중에 추가할 수 있게 사용자 문구와 UI 코드를 번역 문구에 종속시키지 않아야 한다.

## 결정

### 시간대

- 절대 시각은 UTC로 저장한다. 일정 입력, 반복 규칙, 종료일 해석에는 고정 offset이 아닌 IANA time zone을 저장한다.
- Household의 `default_time_zone`은 새 시간 일정과 반복 규칙의 기본값이다. 초기값은 `Asia/Seoul`이며, 변경은 새 일정의 기본값에만 적용한다.
- `User.time_zone`은 해당 사용자에게 보이는 날짜·시간을 표시하는 기준이다. 반복 규칙은 자체 time zone을 보존하며 사용자의 time zone 변경으로 기존 예정 시각을 이동시키지 않는다.
- 일정 편집 UI에는 해당 schedule이 사용하는 time zone을 표시한다. 반복 규칙을 바꾸는 경우 규칙 zone을 기준으로 local date/time을 편집한다.
- DST gap/overlap 계산은 `D-064` 정책을 따른다.

### 언어와 지역화

- `UserSettings.locale`은 사용자별 설정이다. 기본 locale은 `ko-KR`이며 MVP 지원 locale은 `ko-KR`과 `en-US`다(`D-066`).
- 공유 Web UI와 시스템 생성 문구는 locale resource/key로 분리한다. 추가 언어를 넣기 위해 domain entity, API enum 또는 저장된 사용자 작성 텍스트를 바꿀 필요가 없어야 한다.
- API는 번역된 UI 문구 대신 안정적인 error code, enum, 구조화 값을 반환하고 각 클라이언트가 선택 locale로 표현한다.
- 날짜·시간·숫자·복수형 등 표현은 사용자 locale과 time zone에 맞춘다. Reminder 제목·내용, 이름 등 사용자가 작성한 텍스트는 번역하거나 수정하지 않는다.

## 결과

- 사용자와 household가 서로 다른 time zone을 가져도 일정 실행 기준을 잃지 않는다.
- 브라우저, Android, 후속 iOS가 같은 locale-neutral API를 사용하면서 각자 표시를 현지화할 수 있다.
- MVP 번역 resource는 `ko-KR`과 `en-US`로 제공하고, 언어를 추가할 때마다 해당 번역 검수를 별도로 진행한다(`D-066`).

## 구현 확인 사항

- Household, User, RecurrenceRule, Occurrence 시간대의 소유 범위를 혼동하지 않도록 API DTO와 UI 입력 계약에 zone을 명시한다.
- User time zone 변경은 저장된 recurrence rule과 기존 occurrence의 실행 instant를 변경하지 않는다.
- 시스템 생성 알림 문구는 기기 locale로 구성하고 사용자가 입력한 Reminder 문구는 원문 그대로 전달한다.
- 날짜·시간 표시, 일정 편집, DST와 다른 기기 time zone을 함께 검증한다.
