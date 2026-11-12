# ADR-014: 기기 로컬 시간 알림과 FCM 변경 동기화 신호

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-004`, `D-006`, `D-007`, `D-045`~`D-050`, `D-075`
- 관련 요구사항: `PR-AC-005`, `PR-AC-013`, `PR-AC-037`, `PR-AC-040`, `PR-AC-041`, `PR-AC-060`, `F-NOT-003`, `F-NOT-004`, `F-NOT-009`

## 맥락

시간 알림은 특정 시각에 기기 시스템 알림으로 표시되어야 한다. Reminder는 서버에서 생성·수정되고
담당자별 설치 기기에 예약을 반영해야 한다. FCM은 Android 백그라운드 앱에 변경을 알리는 데 쓸 수
있지만, FCM notification payload는 사용자에게 직접 보이고 전달 시각도 로컬 시각 예약과 다르다.

## 결정

- due-time 사용자 알림은 각 담당자의 알림 가능한 설치에서 Android `AlarmManager`의 로컬 예약으로
  표시한다. 서버의 동기화된 Occurrence가 schedule의 기준이며, 각 설치는 앱 시작·foreground 복귀·부팅·
  permission 변경·server change sync 후 예약 상태를 reconcile한다.
- Android MVP는 FCM을 비사용자용 ChangeSignal 전달에 사용한다. Reminder·Occurrence·Assignment 변경,
  완료·취소·건너뛰기·놓침·보관처럼 담당자 기기의 예약을 바꿔야 하는 server revision을 현재·이전 Assignment의
  영향을 받는 설치에 알린다. 담당 해제된 기기에도 남은 local trigger를 취소하도록 signal을 보낸다.
- ChangeSignal은 Android FCM data message로 전달하며 필요한 `household_revision`, entity ID/version,
  signal type만 포함한다. 제목·본문·장소 좌표를 포함하지 않고 notification payload를 사용하지 않는다.
  수신 시 기기는 인증된 API에서 변경사항을 가져오고 local time alarm/geofence를 reconcile한다.
- 같은 signal이 중복 전달되어도 `installation_id + household_revision + signal_type` key와 client cursor로
  같은 변경을 한 번만 적용한다. FCM 수신·동기화 완료를 사용자에게 보이는 알림으로 표시하지 않는다.
- FCM은 best-effort다. 이미 기기에 예약된 시간 알림은 FCM 수신에 의존하지 않는다. FCM을 놓친 변경은
  다음 앱 시작·foreground 복귀·부팅 full sync에서 수렴한다. 정확 알람 접근 거부 시 fallback은 `D-047`,
  늦은 알림 catch-up cutoff는 `D-048`, FCM ChangeSignal retry·TTL은 `D-049`, Android force-stop 제한과
  직접 재실행 후 복구는 `D-050`에 따른다.
- 알림은 활성 담당자의 알림 가능한 설치에만 예약한다(`D-045`). 비담당자는 업무를 조회·수정·완료할 수
  있지만 user-facing alarm recipient가 아니다.

## 결과

- FCM과 Android 로컬 alarm의 역할이 분리된다. FCM은 server state invalidation, local scheduler는 정확한
  due-time 표시를 담당한다.
- FCM signal delivery가 지연되어도 미리 동기화된 회차의 alarm은 기기에서 울린다.
- 새 변경이 FCM으로 도착하지 않으면 해당 설치가 그 변경을 fetch하기 전까지 새 schedule이 늦게 반영될
  수 있다. foreground/start reconciliation은 복구 경로이며 FCM의 hard delivery SLA는 약속하지 않는다.
- `Q-018`의 FCM 사용과 local time alarm 조합 선택을 해결한다.
