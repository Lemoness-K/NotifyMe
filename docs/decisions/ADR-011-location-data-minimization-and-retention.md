# ADR-011: 장소 데이터 최소화와 보존 기간

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-037`, `D-041`, `D-042`, `D-043`
- 관련 요구사항: `PR-AC-016`, `NFR-SEC-001`, `NFR-SEC-005`

## 맥락

장소 조건은 휴대폰 OS geofence로 판정할 수 있어 사용자의 이동 경로를 수집할 필요가 없다. 장소
알림의 중복 처리와 전달 진단에는 event 식별 정보와 결과가 필요하지만, 이를 장기간 보존할 필요는
없다. 한편 Android/iOS geofence 등록에는 사용자가 Reminder에 지정한 장소의 중심 좌표가 필요하다.

## 결정

- 사용자의 실시간 GPS 좌표 sample이나 이동 경로를 앱 데이터베이스, 서버, 운영 로그에 수집하거나
  보존하지 않는다. geofence 판정은 OS에 등록된 사용자가 선택한 장소·반경으로 기기에서 수행한다.
- 사용자가 Reminder에 지정한 geofence 중심 좌표와 반경은 해당 LOCATION Trigger 설정으로 서버에
  저장하고 대상 기기의 OS geofence 등록에 전달한다. 이 값은 사용자의 현재 위치·이동 경로와 다른
  설정 자료이며, 변경 이력에는 정확한 좌표를 표시하지 않는다(`D-037`).
- 서버는 장소 condition event의 중복 방지·전달 진단을 위해 다음 비좌표 metadata만 보존한다:
  `condition_event_id`, `installation_id`, `occurrence_id`, trigger revision, 조건 종류, 감지 시각,
  처리·전달 결과. event가 감지된 시점부터 30일 뒤 이 metadata를 삭제한다.
- 기기의 local event journal에는 같은 event metadata 중 동기화·중복 방지에 필요한 최소 필드만
  저장한다. 좌표나 경로는 기록하지 않으며 서버가 수신을 확인하면 journal 항목을 삭제한다. 서버
  확인 전 항목은 동기화 재시도와 회차 종료 처리에 필요한 동안만 남긴다.
- 장소 condition event는 사용자가 보는 Reminder 변경 이력에 별도 활동 기록으로 표시하지 않는다.

## 결과

- 장소 알림을 위해 사용자의 위치 이력을 수집하거나 저장하지 않는다.
- 사용자가 지정한 장소 좌표는 알림 기능을 수행하기 위한 Trigger 설정으로만 보존한다.
- 서버의 event metadata는 30일을 넘겨 보존하지 않으며, 이 보존 기간은 사용자 설정이 아니다.
- `Q-013`의 위치 설정·event data retention 항목을 해결한다.
