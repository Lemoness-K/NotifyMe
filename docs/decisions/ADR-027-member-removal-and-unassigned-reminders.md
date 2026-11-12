# ADR-027: 구성원 제거와 무담당 리마인더

- 상태: 승인됨
- 날짜: 2026-11-09
- 관련 결정: `D-010`, `D-020`, `D-021`, `D-045`, `D-050`, `D-059`, `D-060`
- 후속 정책: 무담당 반복 Reminder 일시 중지 ([ADR-028](./ADR-028-unassigned-recurrence-pause.md))
- 관련 요구사항: `F-HH-005`, `PR-AC-013`, `PR-AC-026`, `PR-AC-045`, `PR-AC-046`
- 관련 문서: [마스터 설계](../00-master-design.md), [제품 요구사항](../01-product-requirements.md), [도메인·데이터 설계](../02-domain-and-data-design.md), [알림·스케줄링](../04-notification-and-scheduling.md), [보안·개인정보](../07-security-and-privacy.md)

## 배경

Admin은 가구 구성원을 제거할 수 있다. 제거된 구성원이 만든 Reminder나 과거 업무를 지우면 가구의
공유 기록이 깨지고, 다른 구성원에게 남은 업무도 잃게 된다. 반면 해당 구성원이 더 이상 가구에
속하지 않으면 API 접근과 새 알림 전달은 중단되어야 한다. 마지막 담당자가 제거된 현재 미완료 회차는
완료 여부가 아직 결정되지 않았으므로 그대로 남겨야 한다.

## 결정

- Admin만 다른 구성원을 제거할 수 있다. 마지막 Admin의 제거·강등은 다른 Admin에게 역할을 넘기는
  기존 원자적 처리 규칙을 따른다(`D-021`).
- 구성원 제거는 Membership를 비활성화하고 해당 household의 API 접근을 즉시 거부한다. Membership와
  User identity는 과거 이력의 참조를 위해 보존한다.
- 제거된 사용자를 활성 Assignment와 해당 household의 notification recipient에서 해제한다. Reminder,
  Occurrence, 완료 기록과 과거 변경 이력은 삭제하지 않는다. 활성 Assignment 이력은 종료 시각과 행위자를
  남긴다.
- 다른 활성 담당자가 남아 있으면 그 담당자에게 업무와 알림을 계속 제공한다. 담당자가 하나도 남지 않으면
  현재 `PENDING` Occurrence를 담당자 없는 미완료 상태로 유지한다. 활성 household 구성원은 계속 이를
  조회·수정·완료할 수 있지만, 담당자가 지정될 때까지 시간 알림과 geofence를 등록하지 않는다(`D-010`, `D-059`).
- 구성원 제거는 API 권한과 서버 notification target을 먼저 갱신하고, 해당 설치에 household 접근 회수용
  control signal을 보낸다. 수신한 기기는 그 household의 캐시·로컬 알람·geofence를 제거한다. 신호를 놓쳐도
  다음 앱 실행 시 API의 접근 거부를 확인하면 같은 정리를 수행한다. FCM은 best-effort이므로 force-stop 중
  즉시 정리를 보장하지 않는다(`D-050`).
- 남은 구성원은 기존 Reminder CRUD 권한에 따라 담당자를 다시 지정할 수 있다(`D-010`). 담당자가
  없어지는 순간의 반복 일시 중지와 재개 규칙은 `D-060` 및 [ADR-028](./ADR-028-unassigned-recurrence-pause.md)을 따른다.

## 결과

- 구성원 제거 시 공유 데이터와 과거 감사 정보는 보존되고, 새 요청에 대한 권한은 즉시 차단된다.
- 여러 담당자 중 한 명만 제거되면 남은 담당자들의 예약은 유지하고 제거된 구성원의 예약만 취소한다.
- 마지막 담당자 제거 뒤에는 현재 미완료 작업이 가구의 무담당 항목으로 남으며, 새 알림은 발생하지 않는다.
- 기기 로컬 정리는 제거 신호 또는 다음 권한 확인 시 수행한다. force-stop 중 이미 등록된 알람의 즉시 취소는
  OS 제약으로 보장할 수 없다.
- 무담당 반복 Reminder는 규칙을 보존한 채 자동 일시 중지하고 재지정 후 미래 일정부터 재개한다(`D-060`, [ADR-028](./ADR-028-unassigned-recurrence-pause.md)).

## 구현 전 검증

- Membership 비활성화, 활성 Assignment 종료, ChangeSignal 생성이 하나의 일관된 서버 명령으로 처리된다.
- 남은 담당자가 있을 때 해당 설치의 예약은 유지되고 제거된 사용자 설치만 정리된다.
- 마지막 담당자를 제거하면 현재 회차가 사라지거나 완료 처리되지 않고 무담당·미완료로 남는다.
- 접근 회수 신호와 다음 실행 시 권한 거부 양쪽에서 household 캐시와 local triggers가 정리된다.
