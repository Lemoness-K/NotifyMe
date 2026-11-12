# ADR-017: FCM ChangeSignal 재시도와 TTL

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-007`, `D-046`, `D-049`
- 관련 요구사항: `PR-AC-037`, `PR-AC-040`, `NFR-REL-005`

## 맥락

FCM은 사용자에게 보이는 시간 알림이 아니라, 담당자 설치가 서버의 최신 revision을 가져와 로컬 예약과
지오펜스를 reconcile하게 하는 ChangeSignal 전달 수단이다(`D-046`). 서버의 FCM send 요청이 성공해도
메시지가 실제 기기에 도착했다는 뜻은 아니다. FCM 메시지에는 보관·전달 유효 기간(TTL)을 지정할 수 있고,
TTL을 생략하면 기본 보관 기간이 최대 4주라 오래된 동기화 신호가 뒤늦게 도착할 수 있다.

## 결정

- Reminder revision과 ChangeSignal Outbox 항목은 같은 DB transaction에서 생성한다. Outbox의
  `expires_at`은 `created_at + 24 hours`다.
- FCM에 보내기 전 발생한 일시적인 전송 오류는 exponential backoff로 재시도하되 `expires_at` 이후에는
  보내지 않는다. 영구 오류는 재시도하지 않고 실패 상태로 기록한다.
- 각 FCM 전송에 설정하는 TTL은 Outbox의 남은 유효시간이다. 최초 전송 시 남은 기간은 최대 24시간이며,
  재시도 시 TTL을 다시 24시간으로 초기화하지 않는다.
- FCM이 요청을 수락하면 서버 측 재발송을 멈춘다. FCM은 신호를 TTL 내에서 best-effort로 전달한다.
  실제 수신이나 client revision 적용은 FCM 수락 응답으로 간주하지 않는다.
- Outbox가 만료되거나 TTL 내에 기기로 전달되지 않으면 신호를 폐기한다. 다음 앱 시작·foreground 복귀·
  부팅 동기화가 현재 server revision을 가져와 상태를 복구한다. ChangeSignal은 notification payload 없이
  data-only로 유지하며 notification tray에 표시하지 않는다(`D-046`).

## 결과

- 만료된 revision 신호를 수일 또는 수주 뒤 다시 처리하지 않고, 사용자에게 보이지 않는 단순 동기화 신호로
  유지한다.
- FCM 서비스 장애가 24시간 이상 이어지면 background 설치의 변경 반영은 지연될 수 있다. 기기 sync
  fallback은 복구 경로이며 즉시 반영 SLA를 보장하지 않는다.
- FCM TTL은 Android/Web에서 최대 28일까지 설정할 수 있고, 미설정 시 기본 기간은 최대 4주다. Notify Me는
  명시적으로 남은 유효기간을 전달해 총 signal lifetime을 24시간으로 제한한다.

## 공식 근거

- [Firebase: Set the lifespan of a message](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan): TTL의 역할·범위·기본값, FCM 수락이 기기 전달을 뜻하지 않는다는 설명.
