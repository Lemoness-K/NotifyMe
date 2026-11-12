# ADR-015: 정확 알람 권한 거부 시 동작

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-003`, `D-004`, `D-006`, `D-008`, `D-019`, `D-045`~`D-047`
- 관련 요구사항: `PR-AC-004`, `PR-AC-005`, `PR-AC-008`, `PR-AC-022`, `PR-AC-038`

## 맥락

시간 Reminder는 담당자 기기의 Android 로컬 예약으로 표시한다(`D-046`). 정확한 시각에 울리는 Android
알람은 OS 버전과 앱 target에 따라 별도 “알람 및 리마인더” 접근 권한이 필요할 수 있고, 신규 설치에
권한이 없을 수 있다. 이 권한은 Android 알림 표시 권한(`POST_NOTIFICATIONS`)과 별개다. 사용자가
접근을 허용하지 않아도 Reminder 입력을 막지 않으면서 실제 알림 가능성을 분명히 보여줘야 한다.

## 결정

- Android 앱은 정확한 시간 알림이 필요한 설치에서 `PermissionGateway`로 권한 상태를 확인하고,
  `SystemSettingsGateway`로 해당 OS 접근 설정 화면을 연다. 사용자가 직접 허용하며 앱은 권한을 우회하거나
  강제로 켜지 않는다.
- 권한 거부 또는 회수 상태에서도 Reminder와 서버 Trigger 저장은 허용한다. 해당 담당자 설치에서는
  Android 부정확 알람 fallback을 예약하며, 정해진 시각에 울린다고 보장하지 않는다.
- Notify Me의 기기 상태 화면은 권한 상태를 installation별로 보여준다. 정확 접근이 없으면
  `TIME_ALARM_MAY_BE_DELAYED` 상태, 지연 가능 안내와 해당 OS 설정 화면 바로가기를 제공한다.
- 앱이 foreground로 돌아오거나 OS가 권한 상태 변경을 알리면 local schedule을 reconcile한다. 권한 허용
  시 해당 설치의 미래 알람을 정확 예약으로 바꾸고, 권한 회수 시 부정확 예약으로 낮춘다. 다른 설치의
  권한·예약에는 영향을 주지 않는다.
- 알림 표시 권한이나 알림 채널이 차단된 경우는 정확 알람 접근과 별도의 기기 상태로 안내한다.
- 권한의 마지막 관찰값은 `DeviceInstallation` capability로 관리하며 Household 또는 User preference로
  취급하지 않는다(`D-019`).

## 결과

- 사용자는 정확 알람 권한을 거부해도 Reminder를 저장할 수 있지만 해당 기기의 표시 시각은 늦어질 수 있다.
- 권한 설정을 바꾸면 알림 예약이 자동 조정되고, 다른 담당자 설치는 독립적으로 동작한다.
- Android OS·target SDK에 따른 접근 방식 차이는 native adapter가 감싼다. 늦은 알림의 24시간 catch-up은
  `D-048`, FCM ChangeSignal 재시도·TTL은 `D-049`를 따른다.

## 공식 근거

- [Android: Schedule alarms](https://developer.android.com/develop/background-work/services/alarms): 정확한 사용자 알림에 exact alarm을 쓰는 경우와 권한 선택·요청 방식.
- [Android 14: Schedule exact alarms are denied by default](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms): 신규 설치에서 `SCHEDULE_EXACT_ALARM`이 기본 거부될 수 있으며, 권한이 없으면 graceful degradation을 적용하도록 안내.
