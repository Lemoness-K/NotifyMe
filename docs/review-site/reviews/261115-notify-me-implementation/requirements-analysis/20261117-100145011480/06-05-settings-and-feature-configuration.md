---
layout: review
title: "앱 설정과 선택 기능 설계"
source_path: "docs/05-settings-and-feature-configuration.md"
permalink: "/reviews/261115-notify-me-implementation/requirements-analysis/20261117-100145011480/06-05-settings-and-feature-configuration/"
---

# 앱 설정과 선택 기능 설계

- 상태: 초안
- 최근 갱신일: 2026-11-17
- 관련 결정: `D-018`~`D-022`, `D-026`, `D-038`~`D-040`, `D-047`, `D-050`~`D-052`, `D-065`~`D-066`, `D-073`, `D-085`~`D-086`, `D-093`
- 관련 요구사항: `F-SET-001`~`F-SET-007`, `PR-AC-021`~`PR-AC-027`, `PR-AC-038`, `PR-AC-041`~`PR-AC-043`, `PR-AC-050`~`PR-AC-052`, `PR-AC-057`, `PR-AC-066`~`PR-AC-067`, `NFR-TIME-001`~`NFR-TIME-004`, `NFR-I18N-001`~`NFR-I18N-002`
- 관련 문서: [마스터 설계](./00-master-design.md), [제품 요구사항](./01-product-requirements.md), [도메인·데이터 설계](./02-domain-and-data-design.md), [시스템 아키텍처](./03-system-architecture.md)

## 1. 목적과 범위

앱 주 메뉴나 프로필 메뉴에서 접근하는 별도 설정 화면을 제공한다. 설정값은 `HOUSEHOLD`,
`USER`, `INSTALLATION`, `REMINDER` 중 정확히 하나의 소유 범위에 둔다. 전역 설정 화면에서는
가구·개인 설정과 설치별 상태를 보여주고, `REMINDER` 범위 값은 해당 Reminder를 만들거나
수정하는 흐름에서 다룬다(`D-019`).

사용자가 선택적으로 끄거나 값을 조정할 수 있는 기능은 설정에 등록한다. 모든 설정은
해당 기능의 동작, 범위, 기본값, 비활성화 및 제거 시 처리를 함께 정의한다. 필수 동작은
사용자에게 끄기 옵션을 노출하지 않는다.

## 2. 설정 화면 트리

```text
앱 설정
├── 가구 설정 (`HOUSEHOLD`)
│   ├── 장소 반경 최소값: 50m, 기본값: 100m, 최대값: 500m
│   ├── 장소 조건 시간 입력 상한: 기본 60분, 조정 범위 10~1,440분
│   ├── 주간 반복 달력 기준: 월요일 시작 기본, 일요일 시작 또는 ISO 8601 선택
│   └── 가구 공통 선택 기능의 활성 여부와 정책
├── 개인 설정 (`USER`)
│   ├── 개인 언어·시간대·표시 선호
│   └── 개인별 선택 기능과 표시 선호
└── 이 기기의 권한·상태 (`INSTALLATION`)
    ├── OS 알림 권한·시간/장소 채널·정확 알람 상태와 Android 설정 바로가기
    ├── Android 앱 강제 종료 시 백그라운드 알림 중단 안내
    ├── 위치 권한·위치 서비스 상태
    ├── 배터리 절전 상태 안내와 OS 설정 바로가기 (앱의 예외 직접 요청 없음)
    └── 동기화·지오펜스 등록 상태

Reminder 생성·수정 흐름
└── 해당 Reminder의 Trigger·반복·선택적 완료 검증 설정 (`REMINDER`)
```

가구 설정은 모든 household 구성원에게 같은 값을 보여준다. 개인 설정은 `user_id`에 귀속되어
같은 사용자 계정의 설치들에 적용한다. 기기 상태 영역은 앱 내부 선호가 아니라 OS와 설치 기기에서
관찰한 capability를 보여주며, 필요한 경우 해당 설치의 OS 설정 화면을 연다. Reminder별 값은
전역 설정 화면에 복제하지 않는다.

MVP 앱은 하나의 household 설정만 노출한다. 설정 데이터와 API는 household scope를 명시해
향후 여러 가구 전환이 추가되어도 가구 간 설정이 섞이지 않게 한다(`D-022`).

## 3. 설정 범위와 적용 규칙

| 범위 | 소유자 | 예시 | 저장·적용 |
|---|---|---|---|
| `HOUSEHOLD` | Household | 기본 시간대, 장소 반경 최소·최대·기본값, 장소 조건 시간 상한, 주간 반복 달력 기본값, 가구 공통 선택 기능 활성화 | `default_time_zone`은 `Household`에, 나머지 household 설정은 `household_id`를 키로 `HouseholdSettings`에 저장하고 구성원에게 공통 적용한다. |
| `USER` | User 계정 | UI locale, 표시 시간대 등 계정별 선호 | `user_id`를 기준으로 `UserSettings` 또는 `User` 프로필에 저장하고 같은 사용자의 설치에서 읽는다. |
| `INSTALLATION` | 앱 설치/기기와 해당 OS | OS 권한·알림 채널, 정확 알람·위치 capability, 기기별 동기화·geofence 등록 상태 | 기기별 상태로 유지한다. Android OS가 소유하는 설정을 앱 서버나 다른 설치에 복제하지 않는다(`D-073`). |
| `REMINDER` | Reminder 및 관련 Trigger/RecurrenceRule | Trigger 종류·장소 event·실제 반경·duration, 반복 규칙, 선택적 완료 검증 설정 | 각 Reminder의 업무 데이터에 저장하고 권한이 있는 household 설치로 동기화한다. `HouseholdSettings`나 `UserSettings`에 복제하지 않는다. |

각 설정값에는 한 개의 소유 범위만 부여한다. 기본값은 범위별 저장값이 없을 때 적용되는 초기값이며, 저장된 업무 데이터에 별도 사본을 둘 필요가 있으면 그 사본은 활성 설정이 아니라 해당 업무 객체의 당시 조건으로 다룬다. 예를 들어 Household의 `weekly_calendar_convention`은 새 반복 규칙의 기본값이고, 생성된 `RecurrenceRule`의 convention은 해당 Reminder 일정의 고정된 업무 값이다. Household 기본값을 바꿔도 기존 규칙은 바뀌지 않는다(`D-086`). 장소 반경도 가구 기본값과 범위값은 `HOUSEHOLD`, 특정 Trigger의 `radius_m`는 `REMINDER`다. 범위 변경으로 기존 값을 조정하는 예외는 `D-040`에 한정한다.

언어(locale)는 `USER` 설정이며 MVP에서 `ko-KR`과 `en-US`를 선택할 수 있다. 유효한 저장 locale은 기기 locale보다 우선하고, 없거나 더 이상 지원되지 않을 때 지원되는 기기 locale을 사용하며, 미지원 기기 locale은 `ko-KR`로 fallback한다(`D-093`). `locale`은 `UserSettings`에 `user_id` 기준으로 저장해 같은 사용자의 설치들에 동기화한다(`D-066`). 사용자의 표시 시간대는 User 프로필의 IANA `time_zone`이며 household의 `default_time_zone`과 별개다. 같은 User 프로필을 사용하는 설치에는 같은 표시 시간대를 적용한다. 새 일정은 household 기본 시간대를 사용하고, 반복 규칙에 기록된 시간대가 실행 기준이다. 사용자 표시 시간대를 바꿔도 기존 일정은 이동하지 않는다(`D-065`). 사용자별 다른 표시 선호는 범위가 결정되기 전까지 새 설정으로 임의 추가하지 않는다.

장소 반경의 최소값·최대값·기본값은 가구 설정이다(`D-018`). 초기값은 각각 50m·500m·100m다(`D-038`). 반경 슬라이더에서 저장하는
실제 값은 Reminder마다 별도로 둔다(`D-017`). 기본값은 새 장소 Trigger의 초기값으로 사용한다.
MVP에서 슬라이더는 25m 단위로 움직인다(`D-039`). 실제 사용 후 필요하면 간격을 재조정한다.
최소·최대값을 바꿨을 때 활성·보관 Reminder의 LOCATION Trigger 값이 범위 밖에 놓이면 새 경계값으로 자동 조정한다.
가구 설정과 영향받은 Trigger 값은 하나의 트랜잭션으로 저장하고, 조정 이력을 기록한 뒤 기기
지오펜스에 새 반경을 반영한다(`D-040`). 조정 전·후 값은 변경 이력에서 확인할 수 있다(`D-037`).

장소 조건 시간 상한 `max_location_duration_min`은 기본 60분이며 10~1,440분으로 설정한다(`D-085`). 상한 변경은 이미 저장된 Trigger duration을 조정하지 않고, 새 duration을 만들거나 해당 duration을 수정할 때 검증한다. 가구 반복 설정 `weekly_calendar_convention`은 `MONDAY_START | SUNDAY_START | ISO_8601`이며 기본은 `MONDAY_START`다(`D-086`). ISO는 ISO week-year 표기 convention이다. 현재 N주 반복은 최초 예정 회차를 anchor로 삼으므로 `MONDAY_START`와 `ISO_8601`의 회차 날짜 계산 결과는 같다. 설정 화면에서 이 의미를 짧게 설명한다. 새 RecurrenceRule은 생성 시 convention을 복사하므로 household 기본값의 변경이 기존 반복 일정을 이동시키지 않는다. 기존 규칙의 convention은 반복 설정을 명시적으로 수정하고 적용 범위를 확인한 경우에만 바꾼다(`D-063`); 계산 재생성 규칙은 `DS-010`에서 구체화한다.

가구 설정은 Admin만 편집한다(`D-020`). 활성 가구는 Admin 1명 이상을 유지하며 Member는
0명 이상일 수 있다(`D-021`). 개인 설정은 해당 사용자 본인이 편집한다. 기기 권한과 잠금 화면
알림 공개 여부는 사용자가 OS에서 직접 설정한다. 앱은 상태 안내와 Android 알림 설정 이동만
제공하며, 알림은 `VISIBILITY_PRIVATE`와 가린 문구를 사용한다(`D-026`).

설정값이 저장되어 있지 않으면 해당 설정 카탈로그의 버전이 지정된 기본값을 사용한다.
가구에서 기능을 끄면 개인 설정으로 다시 켤 수 없다. 개인 설정은 기능을 쓰는 사용자의
선호만 좁히며, 설정을 바꾸지 않은 다른 구성원에게 영향을 주지 않는다. 기기 capability가
부족하면 해당 기기에서만 제한 상태를 표시하고 다른 구성원 기기의 알림을 막지 않는다.

## 4. 설정 카탈로그

설정 카탈로그는 설정 메타데이터의 단일 기준 목록이다. 이 문서의 §7이 요구사항·상세 설계의
기준 목록이고, 구현에서는 같은 선언을 정적 `Settings Catalog` registry로 둔다. 설정 UI는
registry를 scope와 표시 위치에 따라 묶어 보여준다. 카탈로그는 실제 설정값 저장소가 아니다.
실제 값은 소유자 aggregate/업무 entity에 각각 저장하며, 의미와 검증 로직은 소유 기능 모듈이
관리한다. 카탈로그 entry는 그 validator와 저장 위치를 참조한다. 운영 중 임의의 설정 코드를
DB에서 생성하는 범용 plugin 시스템은 만들지 않는다.

선택 가능하거나 사용자가 값을 조정할 수 있는 설정의 선언에는 다음 정보가 필요하다.

| 속성 | 의미 |
|---|---|
| `feature_id`, `setting_id` | 안정적인 기능·설정 ID |
| `scope` | `HOUSEHOLD`, `USER`, `INSTALLATION`, `REMINDER` 중 소유 범위 |
| `owner_key`, `value_location` | 소유자 식별 키와 실제 기준 저장 위치 |
| `sync_policy`, `presentation` | scope 내 적용·동기화 방식과 편집·상태 표시 위치 |
| `kind`, `schema_version` | 값 형식과 검증 스키마 버전 |
| `default_value` | 새 범위/항목에서 쓸 기본값 |
| `constraints` | 허용 범위, enum, 상호 조건 등 |
| `optional`, `enabled_by_default` | 기능을 끌 수 있는지와 초기 상태 |
| `dependencies` | 다른 설정·권한·기능에 필요한 조건 |
| `disabled_behavior` | 끄면 기존 데이터·예약·사용 흐름이 어떻게 바뀌는지 |
| `migration` | 기능 변경·제거 시 기존 설정·도메인 데이터 전환 방식 |

한 기능이 여러 scope의 값을 함께 사용하는 경우에도 각각은 별도의 catalog entry와 소유 범위를
가진다. 가구 공통 기능 활성 여부와 설치별 OS 알림 권한·채널 상태가 함께 영향을 주는 기능은 각
scope의 정책을 모두 검사한다. Household가 기능을 꺼두면 USER나 INSTALLATION 범위에서 다시 켤 수 없다.
기기 권한 또는 OS 알림 채널이 차단되면 해당 설치만 전달할 수 없고 다른 구성원 기기는
영향을 받지 않는다. MVP는 개인 알림 수신 선호를 서버 `UserSettings`로 저장하지 않는다(`D-073`).
설정 항목 metadata는 catalog에 한 번 선언하고, 실제 live value를 여러 scope에 중복 저장하지 않는다.
환경별 실행 설정과 비밀값은 제품 설정 카탈로그 밖에서 관리한다.

## 5. 기능 추가·변경·제거 규칙

기능을 추가하거나 기존 기능을 바꿀 때 설계자는 다음을 확인한다.

1. 기능 트리에 `F-*` ID를 추가하고 필수 기능인지 선택 기능인지 결정한다.
2. 조정 가능한 값과 선택 토글의 소유 범위를 `HOUSEHOLD`, `USER`, `INSTALLATION`, `REMINDER` 중 정확히 하나로 정한다.
3. 기본값, 자료형, 허용 범위, 의존성, 서버 검증과 클라이언트 표시를 정의한다.
4. 기능을 끌 때 새 입력, 저장된 데이터, 예약 알림, 사용자 이력에 미칠 영향을 정한다.
5. 설정 카탈로그 항목과 API/데이터 스키마 버전 및 마이그레이션을 추가한다.
6. 기능을 제거할 때 기존 값을 조용히 버리거나 업무 기록을 삭제하지 않는다. 이전 값의
   보존·후속 설정으로의 변환·기능 종료 안내를 정하고 마이그레이션을 기록한다.
7. 정상 사용, 비활성화, 재활성화, 업그레이드·복구 기준을 요구사항과 검증 계획에 추가한다.

비활성화의 실제 효과는 기능별로 다를 수 있으므로 전역적으로 모든 기능을 숨기거나
데이터를 삭제하는 동작을 가정하지 않는다. 각 기능은 과거 데이터 보존, 신규 입력 허용,
기존 예약을 유지·중단·취소할지 명시한다. 삭제 또는 변환이 필요하면 사용자가 확인할 수
있게 하고, 가역성·감사·백업 영향을 다룬다.

## 6. 값 저장과 API 경계

- `HouseholdSettings`와 `UserSettings`는 별도 논리 aggregate와 별도 revision을 가진다.
- 논리 필드는 `HouseholdSettings { household_id, schema_version, revision, values }`,
  `UserSettings { user_id, schema_version, revision, values }`다. `values`는 설정 카탈로그에
  선언된 feature-owned 구조이며, DB별 저장 표현은 관계형 DB 선택 때 정한다.
- `USER` scope의 `locale`은 `UserSettings`에, 표시 시간대는 기존 `User.time_zone` 프로필 필드에 저장한다. 서버는 인증된 `user_id` 범위로 조회·수정하며, 그 사용자의 설치들은 동일한 account value를 읽는다.
- `INSTALLATION` scope의 OS 권한·알림 채널 설정은 OS가 기준값을 소유한다. 앱은 설치별 관찰 상태와 `DeviceInstallation`/`SyncState`를 관리하고, OS 값을 `HouseholdSettings`나 `UserSettings`로 복사하지 않는다.
- `REMINDER` scope의 값은 해당 `Reminder`, `Trigger` 또는 `RecurrenceRule`에 저장한다. Reminder API가 해당 업무 데이터의 권한과 revision을 검증하며, household/user 설정 API에 넣지 않는다.
- 개인 설정 API는 인증된 사용자 범위만 읽고 쓸 수 있다. 가구 설정 API는 household membership과
  `ADMIN` role을 검사한다(`D-020`). Admin 인계·퇴장 처리는 활성 Admin 1명 이상을 보장한다(`D-021`).
- Reminder 값은 기존 Reminder 작업 권한으로 읽고 수정한다. 설치 상태 갱신은 해당 인증 User가 소유한 설치 ID로 한정한다.
- 모든 설정 변경은 서버에서 scope, schema version, 값 범위, actor 권한을 검증한다.
- 설정 업데이트는 기대 revision을 확인해 동시 수정을 감지하고, household 설정 변경은
  actor와 변경 요약을 감사 기록에 남긴다.
- MVP DB는 SQLite다(`D-053`). 설정 값은 카탈로그 스키마 검증을 거친 feature-owned 구조이며, SQLite의 물리 저장 표현은 도메인 API에 노출하지 않는다. 의미가 불분명한 임의 key/value 문자열을 도메인 API에 노출하지 않는다.
- 알림 provider token, 인증 비밀, 정확한 현재 위치는 일반 설정 값이나 설정 화면 payload에
  저장하지 않는다.
- 환경별 실행 설정과 비밀값은 deployment/runtime 설정으로 관리하며 이 문서의 사용자 설정 카탈로그에 포함하지 않는다.

## 7. 현재 설정 항목

| 설정 항목 | 범위 | 기준 저장 위치 | 현재 결정 | 미결정 |
|---|---|---|---|---|
| 새 일정의 기본 시간대 `default_time_zone` | `HOUSEHOLD` | `Household.default_time_zone`, `household_id` | 초기 `Asia/Seoul`; 이후 새 일정의 기본값으로만 적용 (`D-065`) | — |
| 장소 반경 기본값 | `HOUSEHOLD` | `HouseholdSettings` | 초기값 100m (`D-018`, `D-038`) | — |
| 장소 반경 최소·최대 | `HOUSEHOLD` | `HouseholdSettings` | 초기값 50m·500m; Admin 조정 가능; 활성·보관 Reminder의 기존 반경은 새 경계 안으로 조정 (`D-020`, `D-038`, `D-040`) | — |
| 장소 조건 시간 입력 상한 | `HOUSEHOLD` | `HouseholdSettings.max_location_duration_min` | 초기 60분, Admin이 10~1,440분으로 조정. 기존 Trigger duration은 자동 변경하지 않음 (`D-085`, `F-SET-006`, `PR-AC-066`) | — |
| 주간 반복 달력 기본값 | `HOUSEHOLD` | `HouseholdSettings.weekly_calendar_convention` | 월요일 시작(`MONDAY_START`, 기본), 일요일 시작(`SUNDAY_START`), ISO 8601(`ISO_8601`). 기존 RecurrenceRule에는 소급하지 않음 (`D-086`, `F-SET-007`, `PR-AC-067`) | — |
| UI 언어 `locale` | `USER` | `UserSettings { user_id, ... }` | `ko-KR` 또는 `en-US`; 저장값 우선, 미저장 시 지원 기기 locale, 미지원이면 `ko-KR`; 같은 User의 설치에 동기화 (`D-066`, `D-093`) | — |
| 표시 시간대 `time_zone` | `USER` | `User.time_zone` 프로필 필드 | IANA time zone; 사용자 표시 기준이며 household의 새 일정 기본 시간대와 분리; 변경해도 기존 일정은 이동하지 않음 (`D-065`, `PR-AC-051`) | — |
| 그 밖의 개인 표시 선호 | `USER` | 설정 범위가 확정될 때 `UserSettings` | 현재 MVP에서 별도 값을 정의하지 않음. 새 항목은 카탈로그와 승인 요구사항에 등록 후 추가 | 실제 선호 목록과 기본값은 후속 설계 대상 |
| Android 알림 채널·잠금 화면 공개 | `INSTALLATION` | 해당 설치의 Android OS | 시간·장소별 채널과 잠금 화면 공개는 OS가 결정; 앱은 상태·설정 이동만 제공 (`D-026`, `D-073`) | 채널별 초기 importance와 제조사별 설정 이동 검증 |
| Android background location·exact alarm 권한 | `INSTALLATION` | 해당 설치의 Android OS | 거부 시에도 Reminder 저장은 허용하고 해당 설치의 상태·fallback만 표시; 권한 회복 시 해당 설치 예약을 reconcile (`D-044`, `D-047`) | OS별 설정 이동은 Android adapter에서 검증 |
| Android 권한·채널·위치 서비스 관측 상태 | `INSTALLATION` | OS 관측값 및 `DeviceInstallation` | 설치별로 표시; 다른 설치나 User 설정으로 복제하지 않음 | 제조사별 설정 이동 동작 |
| 강제 종료·절전 상태 안내와 동기화/geofence 등록 상태 | `INSTALLATION` | 설치별 상태 및 OS | 강제 종료 중 background 알림은 보장하지 않으며, 앱 재실행 후 sync·reconcile; 절전 예외는 직접 요청하지 않음 (`D-050`, `D-051`) | 제조사별 차이는 실기기에서 확인 |
| Trigger 종류와 장소 event | `REMINDER` | `Reminder`/`Trigger` | Reminder당 `TIME` 또는 `LOCATION` 하나, LOCATION은 event 하나 (`D-014`, `D-015`) | — |
| 실제 장소 반경 | `REMINDER` | `Trigger.radius_m` | Reminder별 미터 값; 초기값은 Household 기본 반경에서 채우고, 적용 범위는 household 경계 규칙을 따름 (`D-017`, `D-040`) | — |
| 실제 장소 event duration | `REMINDER` | 해당 `Trigger`의 `DWELL`/`AFTER_EXIT` 값 | 새 입력·수정 때 Household 상한 검증; 이미 저장한 값은 상한 변경만으로 바꾸지 않음 (`D-085`, `PR-AC-066`) | — |
| 반복 일정의 시간대·달력 convention snapshot | `REMINDER` | 해당 `RecurrenceRule` | 생성 시 household 기본값을 복사해 일정 데이터로 보존; household 기본값 변경만으로 기존 일정은 이동하지 않음 (`D-064`, `D-086`) | — |
| 완료 검증 사용 여부와 검증자 | `REMINDER` | 해당 `Reminder` | 선택 기능으로 포함 (`D-091`, `PR-AC-069`) | 자격·권한·요청 해소·세부 UI/API는 `DS-004`, `DS-009`에서 결정 |

표에서 `INSTALLATION`의 값은 앱 설정 API에 저장하는 사용자 선호와 구분한다. 계정 연결을 위해 서버가 설치 식별자와 sync metadata를 보유하더라도, OS 권한·채널의 설정 원본은 기기에 남는다. 이력 화면의 조회 범위처럼 한 화면 안에서만 유지하기로 정한 값은 영구 설정으로 만들지 않는다(`D-088`).

가구 옵션은 모든 구성원이 공통 값을 보며 Admin만 바꾼다(`D-020`). Member는 0명 이상일 수
있고 활성 household는 Admin을 최소 한 명 유지한다(`D-021`). 마지막 Admin이 나가거나 Member로
강등되려면 다른 구성원을 Admin으로 승격하는 인계를 같은 트랜잭션에서 먼저 완료한다. 인계할
대상이 없거나 동시에 발생한 변경으로 최소 Admin 조건이 깨지면 요청을 거부한다.

사용자의 실시간 GPS 좌표·경로는 기기나 서버에 보존하지 않는다. 장소 Trigger의 사용자가 지정한
중심 좌표는 설정 데이터로 유지하고, 장소 event metadata는 서버에서 30일 뒤 삭제한다(`D-043`). 새
조건마다 한 번 알리고 감지 직후 로컬 알림을 표시하는 동작은 `D-041`~`D-042`에서 확정했으며,
장소 반경 설정과 별도로 관리한다.
