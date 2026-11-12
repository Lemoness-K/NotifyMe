# ADR-008: 장소 반경 범위 변경 시 기존 값 조정

- 상태: 승인됨
- 날짜: 2026-11-08
- 관련 결정: `D-017`, `D-018`, `D-037`~`D-040`
- 관련 요구사항: `PR-AC-020`, `PR-AC-021`

## 배경

각 LOCATION Trigger는 Reminder별 반경을 가진다. Admin이 household의 최소·최대 반경을 바꾸면,
이미 저장된 Reminder의 반경이 새 범위를 벗어날 수 있다. 범위를 벗어난 값을 계속 남기면 이후 수정
화면과 기기 지오펜스 값이 설정과 어긋나므로 일관된 조정 규칙이 필요하다.

## 결정

- Admin이 `minimum_radius_m` 또는 `maximum_radius_m`를 변경하고 유효한 설정 조합을 저장하면 모든
  활성·보관 LOCATION Reminder를 검사한다. 영구 삭제된 Reminder는 대상에서 제외한다.
- 기존 반경 `r`을 새 경계에 맞춰 다음과 같이 조정한다:

  ```text
  adjusted_radius = min(max(r, new_minimum), new_maximum)
  ```

- 새 범위 안에 있는 기존 반경은 유지한다. 밖에 있는 값만 새 최소값 또는 최대값으로 바꾼다.
- 가구 설정과 영향받은 Trigger의 `radius_m`·`version` 변경은 한 트랜잭션에서 저장한다. 유효하지 않은
  설정(`minimum > default` 또는 `default > maximum`)은 저장하지 않는다.
- 각 조정은 해당 Reminder의 변경 이력에 기록한다. 변경자는 설정 변경을 시작한 Admin으로 남기고,
  이전·새 반경과 범위 조정 사유를 표시한다(`D-037`).
- 트랜잭션 커밋 후 동기화 변경을 발행한다. 활성 Reminder는 기기에 새 반경으로 지오펜스를 재등록하고,
  보관된 Reminder는 복원할 때 조정된 반경으로 등록한다.

## 결과

- 설정 업데이트가 실패하면 새 범위나 Trigger 반경 어느 쪽도 부분적으로 반영되지 않는다.
- Admin의 범위 변경은 기존 알림 영역을 바꿀 수 있지만, 각 영향 Reminder의 이전·새 반경을 이력에서
  확인할 수 있다.
- 기기 등록 실패는 동기화·reconcile 경로에서 재시도하며, 서버에 저장된 Trigger 반경이 기준 값이다.
