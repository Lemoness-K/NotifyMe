# ADR-031: 반복 Reminder 수정 범위 선택

- 상태: 승인됨
- 날짜: 2026-11-09
- 결정: `D-063`
- 관련 결정: `D-031`, `D-035`, `D-037`, `D-060`, `D-062`, `D-075`
- 관련 기능: `F-REC-006`
- 관련 요구사항: `PR-AC-049`, `PR-AC-060`
- 관련 문서: [마스터 설계](../00-master-design.md), [제품 요구사항](../01-product-requirements.md), [도메인·데이터 설계](../02-domain-and-data-design.md), [시스템 아키텍처](../03-system-architecture.md), [알림·스케줄링](../04-notification-and-scheduling.md)

## 배경

반복 Reminder를 수정할 때 한 회차만 바꾸려는 경우, 선택한 시점 이후 일정을 바꾸려는 경우,
시리즈 전체를 고치려는 경우가 모두 있다. 사용자가 목적에 맞는 범위를 저장 전에 고를 수 있어야 한다.

## 결정

반복 Reminder 편집 화면에서 저장을 누르면 아래 세 scope를 가진 확인 팝업을 표시한다.

| 팝업 선택 | 적용 범위 |
|---|---|
| 이번 회차만 (`THIS_OCCURRENCE`) | 선택된 Occurrence만 바꾼다. RecurrenceRule과 다른 Occurrence는 유지한다. 반복 패턴 자체는 이 선택에서 바꿀 수 없다. |
| 이번 회차와 이후 회차 (`THIS_AND_FUTURE`) | 선택된 Occurrence와 이후 일정에 변경을 적용한다. 선택보다 앞선 Occurrence 내용과 완료 기록은 유지하고, 선택 지점부터 새 RecurrenceRule version을 적용한다. |
| 전체 반복 (`ENTIRE_SERIES`) | 해당 시리즈의 과거·현재·향후 Occurrence의 변경 가능한 Reminder 데이터를 적용한 값으로 갱신한다. RecurrenceRule도 전체 시리즈에 새 version으로 적용한다. |

- 모든 scope에서 Occurrence ID, Occurrence 진행 상태, 완료 여부, 완료자·완료 시각과 기존 감사 이벤트는
  보존한다. `전체 반복`은 이 완료 사실을 변경하지 않으며, 편집 전후 값과 scope를 별도 감사 이벤트로 추가한다.
- `이번 회차만`의 값은 OccurrenceOverride에 저장하고 RecurrenceRule은 변경하지 않는다.
- 반복 패턴 변경은 `이번 회차와 이후 회차` 또는 `전체 반복`에서만 허용한다.
- 팝업에서 취소하면 어떤 변경도 저장하지 않는다.
- 변경 scope는 클라이언트 표시용 힌트가 아니라 서버 명령 계약의 필수 값이다. 서버는 household 권한과 기대 version을
  검증한 뒤 영향받는 Reminder/Occurrence/RecurrenceRule, 감사 기록과 ChangeFeed를 원자적으로 갱신한다.
- 변경으로 값이 달라진 occurrence의 오래된 기기 알람·geofence를 취소하고, 활성 담당자의 기기에 필요한 trigger만
  재설정한다. 완료·취소·놓침·건너뛴 회차에는 새 알림을 설치하지 않는다(`D-075`).

## 결과

- 수정 범위가 반복 Reminder마다 명확하게 선택되고, 잘못된 영향 범위를 저장하기 전에 확인할 수 있다.
- 단일 회차 override, 시점 이후 새 규칙 version, 전체 시리즈 적용을 분리해 저장한다.
- 전체 반복을 선택해도 완료 상태와 완료자·완료 시각은 보존되며, 변경 이력이 원래 값을 추적한다.
- 시간·장소 trigger set은 선택한 scope의 적용 결과에 맞춰 동기화된다.

## 구현 시 확인 사항

- 반복 Reminder 저장에는 유효한 scope가 필요하고, 단발 Reminder 수정에는 반복 scope를 요구하지 않는다.
- `THIS_OCCURRENCE`는 RecurrenceRule version이나 다른 Occurrence를 수정하지 않는다.
- `THIS_AND_FUTURE`는 선택 지점 앞의 Occurrence 데이터를 건드리지 않는다.
- `ENTIRE_SERIES`는 변경 가능한 데이터만 적용하고 Occurrence identity, 진행 상태와 Completion 사실을 바꾸지 않는다.
- 감사 이벤트에는 적용 scope, 변경 전 값, 변경 후 값, 변경자와 시각이 있다.
- trigger 취소·재등록은 idempotent하며 선택된 scope 밖의 기기 알림에 영향을 주지 않는다.
