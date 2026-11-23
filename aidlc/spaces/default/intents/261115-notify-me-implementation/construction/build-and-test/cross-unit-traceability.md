# Cross-Unit Traceability

AI-DLC `sensor-traceability --stage build-and-test` 결과는 `pass: false`다. 244개 중 240개가 연결됐으며 미연결 ID는 아래 네 개다. 연결 상태는 구현 경로의 증거다. 실행 결과는 [테스트 결과](test-results.md)에서 확인한다.

| ID | 해석 | 담당 |
| --- | --- | --- |
| FR8.3 | 완료 검증 세부 정책은 Requirements Analysis에서 Deferred다. 확정된 자격·철회는 U3 설계와 D-094~D-096에 있고 자동 만료·재알림 정책의 잔여 범위가 남아 있다. | Requirements Analysis · U3 |
| FR9.3 | 운영 보고·장애 세부 정책은 Requirements Analysis에서 Deferred다. 승인된 로컬 부분은 U5 D-098에 연결되고 외부 전달은 후속 범위다. | Requirements Analysis · U5 |
| NFR5.1 | 대표 API p95 500ms 이하는 DS-014 조건에서 측정한다. | Performance Validation |
| NFR5.2 | 메모리·저장장치 쓰기 예산을 확정하고 비교해야 한다. | Performance Validation |

| ID | 추적 상태 | Unit·코드 경로 또는 하위 기준 |
| --- | --- | --- |
| FR1.1 | 연결 | `AC1.1.1`, `AC1.1.2`, `AC1.1.3` |
| FR1.2 | 연결 | `AC1.2.1`, `AC1.2.2` |
| FR1.3 | 연결 | `AC1.6.1`, `AC1.6.2` |
| FR1.4 | 연결 | `AC1.1.1`, `AC1.1.2`, `AC1.1.3` |
| FR1.5 | 연결 | `AC1.1.1`, `AC1.1.2`, `AC1.1.3`, `AC1.4.1`, `AC1.4.2`, `AC1.4.3`, `AC1.4.4` |
| FR1.6 | 연결 | `AC1.3.1`, `AC1.3.2`, `AC1.3.3` |
| FR1.7 | 연결 | `AC1.4.1`, `AC1.4.2`, `AC1.4.3`, `AC1.4.4` |
| FR1.8 | 연결 | `AC1.5.1`, `AC1.5.2`, `AC1.5.3` |
| FR1.9 | 연결 | `AC1.7.1`, `AC1.7.2`, `AC1.7.3` |
| FR1.10 | 연결 | `AC1.7.1`, `AC1.7.2`, `AC1.7.3` |
| FR2.1 | 연결 | `AC2.1.1`, `AC2.1.2`, `AC2.1.3` |
| FR2.2 | 연결 | `AC2.3.1`, `AC2.3.2`, `AC2.3.3` |
| FR2.3 | 연결 | `AC2.4.1`, `AC2.4.2`, `AC2.4.3` |
| FR2.4 | 연결 | `AC2.2.1`, `AC2.2.2`, `AC2.2.3` |
| FR2.5 | 연결 | `AC2.6.1`, `AC2.6.2`, `AC2.6.3`, `AC2.6.4` |
| FR2.6 | 연결 | `AC2.7.1`, `AC2.7.2`, `AC2.7.3` |
| FR2.7 | 연결 | `AC5.4.1`, `AC5.4.2`, `AC5.4.3` |
| FR2.8 | 연결 | `AC2.3.1`, `AC2.3.2`, `AC2.3.3` |
| FR2.9 | 연결 | `AC2.5.1`, `AC2.5.2`, `AC2.5.3` |
| FR2.10 | 연결 | `AC2.6.1`, `AC2.6.2`, `AC2.6.3`, `AC2.6.4` |
| FR3.1 | 연결 | `AC3.1.1`, `AC3.1.2`, `AC3.1.3` |
| FR3.2 | 연결 | `AC3.2.1`, `AC3.2.2` |
| FR3.3 | 연결 | `AC3.3.1`, `AC3.3.2`, `AC3.3.3` |
| FR3.4 | 연결 | `AC3.4.1`, `AC3.4.2` |
| FR3.5 | 연결 | `AC2.6.1`, `AC2.6.2`, `AC2.6.3`, `AC2.6.4` |
| FR3.6 | 연결 | `AC2.6.1`, `AC2.6.2`, `AC2.6.3`, `AC2.6.4` |
| FR3.7 | 연결 | `AC3.5.1`, `AC3.5.2` |
| FR4.1 | 연결 | `AC4.1.1`, `AC4.1.2`, `AC4.1.3` |
| FR4.2 | 연결 | `AC4.2.1`, `AC4.2.2`, `AC4.2.3`, `AC4.2.4` |
| FR4.3 | 연결 | `AC4.4.1`, `AC4.4.2`, `AC4.4.3` |
| FR4.4 | 연결 | `AC4.4.1`, `AC4.4.2`, `AC4.4.3` |
| FR4.5 | 연결 | `AC4.7.1`, `AC4.7.2`, `AC4.7.3` |
| FR4.6 | 연결 | `AC4.3.1`, `AC4.3.2`, `AC4.3.3` |
| FR4.7 | 연결 | `AC4.4.1`, `AC4.4.2`, `AC4.4.3` |
| FR4.8 | 연결 | `AC4.5.1`, `AC4.5.2`, `AC4.5.3` |
| FR4.9 | 연결 | `AC4.2.1`, `AC4.2.2`, `AC4.2.3`, `AC4.2.4` |
| FR5.1 | 연결 | `AC5.1.1`, `AC5.1.2`, `AC5.2.1`, `AC5.2.2`, `AC5.2.3`, `AC5.3.1`, `AC5.3.2` |
| FR5.2 | 연결 | `AC5.4.1`, `AC5.4.2`, `AC5.4.3` |
| FR5.3 | 연결 | `AC5.5.1`, `AC5.5.2` |
| FR6.1 | 연결 | `AC4.6.1`, `AC4.6.2`, `AC4.6.3`, `AC4.6.4` |
| FR6.2 | 연결 | `AC4.6.1`, `AC4.6.2`, `AC4.6.3`, `AC4.6.4` |
| FR6.3 | 연결 | `AC4.6.1`, `AC4.6.2`, `AC4.6.3`, `AC4.6.4`, `AC5.6.1`, `AC5.6.2`, `AC5.6.3`, `AC5.6.4` |
| FR6.4 | 연결 | `AC4.7.1`, `AC4.7.2`, `AC4.7.3` |
| FR7.1 | 연결 | `AC6.1.1`, `AC6.1.2`, `AC6.1.3`, `AC6.1.4` |
| FR7.2 | 연결 | `AC6.2.1`, `AC6.2.2`, `AC6.2.3` |
| FR7.3 | 연결 | `AC4.3.1`, `AC4.3.2`, `AC4.3.3`, `AC6.4.1`, `AC6.4.2` |
| FR7.4 | 연결 | `AC6.3.1`, `AC6.3.2`, `AC6.3.3`, `AC6.3.4` |
| FR7.5 | 연결 | `AC6.3.1`, `AC6.3.2`, `AC6.3.3`, `AC6.3.4` |
| FR7.6 | 연결 | `AC6.5.1`, `AC6.5.2`, `AC6.5.3` |
| FR7.7 | 연결 | `AC6.4.1`, `AC6.4.2` |
| FR7.8 | 연결 | `AC6.6.1`, `AC6.6.2`, `AC6.6.3` |
| FR7.9 | 연결 | `AC6.6.1`, `AC6.6.2`, `AC6.6.3` |
| FR7.10 | 연결 | `AC6.7.1`, `AC6.7.2`, `AC6.7.3` |
| FR7.11 | 연결 | `AC6.8.1`, `AC6.8.2`, `AC6.8.3` |
| FR7.12 | 연결 | `AC6.1.1`, `AC6.1.2`, `AC6.1.3`, `AC6.1.4` |
| FR8.1 | 연결 | `AC7.1.1`, `AC7.1.2`, `AC7.1.3`, `AC7.2.1`, `AC7.2.2`, `AC7.2.3`, `AC7.2.4` |
| FR8.2 | 연결 | `AC7.2.1`, `AC7.2.2`, `AC7.2.3`, `AC7.2.4` |
| FR8.3 | 미연결 | — |
| FR9.1 | 연결 | `AC8.1.1`, `AC8.1.2`, `AC8.1.3` |
| FR9.2 | 연결 | `AC8.1.1`, `AC8.1.2`, `AC8.1.3` |
| FR9.3 | 미연결 | — |
| FR10.1 | 연결 | `AC8.5.1`, `AC8.5.2`, `AC8.5.3`, `AC8.5.4` |
| FR10.2 | 연결 | `AC8.2.1`, `AC8.2.2`, `AC8.2.3`, `AC8.2.4` |
| FR10.3 | 연결 | `AC8.3.1`, `AC8.3.2`, `AC8.3.3`, `AC8.3.4` |
| FR10.4 | 연결 | `AC8.5.1`, `AC8.5.2`, `AC8.5.3`, `AC8.5.4` |
| FR10.5 | 연결 | `AC8.3.1`, `AC8.3.2`, `AC8.3.3`, `AC8.3.4` |
| FR10.6 | 연결 | `AC8.2.1`, `AC8.2.2`, `AC8.2.3`, `AC8.2.4` |
| FR10.7 | 연결 | `AC8.4.1`, `AC8.4.2`, `AC8.4.3` |
| FR10.8 | 연결 | `AC8.3.1`, `AC8.3.2`, `AC8.3.3`, `AC8.3.4` |
| NFR1.1 | 연결 | `u1-core-flow: src/server/auth.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/server/http.ts`, `u4-android-notifications: src/server/auth.ts`, `u5-operations-and-recovery: src/server/operations/socket.ts` |
| NFR1.2 | 연결 | `u1-core-flow: src/server/repository.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: tests/u5/runtime.test.ts` |
| NFR1.3 | 연결 | `u1-core-flow: src/server/repository.ts`, `u2-household-and-settings: tests/u2/repository.test.ts`, `u3-reminder-workflows: src/server/repository.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: src/server/operations/restore.ts` |
| NFR1.4 | 연결 | `u2-household-and-settings: tests/u2/http.test.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/ProtectedState.kt`, `u5-operations-and-recovery: src/server/operations/files.ts` |
| NFR2.1 | 연결 | `u1-core-flow: src/server/http.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/server/delete-journal.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: src/server/operations/archive.ts` |
| NFR2.2 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceNotifications.kt` |
| NFR2.3 | 연결 | `u1-core-flow: src/server/http.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/server/delete-journal.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: src/server/operations/backup.ts` |
| NFR3.1 | 연결 | `u1-core-flow: tests/u1/storage-model.test.ts`, `u2-household-and-settings: tests/u2/repository.test.ts`, `u3-reminder-workflows: tests/u3/http.test.ts`, `u4-android-notifications: tests/u4/repository.test.ts`, `u5-operations-and-recovery: src/server/work-service.ts` |
| NFR3.2 | 연결 | `u1-core-flow: src/server/repository.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleState.kt`, `u5-operations-and-recovery: tests/u5/journal.test.ts` |
| NFR3.3 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts`, `u4-android-notifications: tests/u4/notification-rules.test.ts`, `u5-operations-and-recovery: tests/u5/runtime.test.ts` |
| NFR3.4 | 연결 | `u3-reminder-workflows: tests/u3/delete-journal.test.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt`, `u5-operations-and-recovery: tests/u5/backup.test.ts` |
| NFR4.1 | 연결 | `u1-core-flow: src/server/time.ts`, `u2-household-and-settings: prisma/schema.prisma`, `u3-reminder-workflows: src/server/recurrence.ts`, `u4-android-notifications: android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleRules.kt`, `u5-operations-and-recovery: src/server/operations/reporting.ts` |
| NFR4.2 | 연결 | `u1-core-flow: src/server/time.ts`, `u3-reminder-workflows: tests/u3/recurrence.test.ts`, `u4-android-notifications: android/schedule-core/src/main/kotlin/app/notifyme/schedule/ScheduleRules.kt` |
| NFR5.1 | 미연결 | — |
| NFR5.2 | 미연결 | — |
| NFR5.3 | 연결 | `u1-core-flow: deploy/u1/notify-me.service.example`, `u2-household-and-settings: deploy/u1/Caddyfile.example`, `u3-reminder-workflows: src/server/repository.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: src/server/operations/activation.ts` |
| NFR6.1 | 연결 | `u3-reminder-workflows: tests/e2e/u3/reminder-workflows.spec.ts`, `u4-android-notifications: tests/e2e/u4/installation-notifications.spec.ts` |
| NFR6.2 | 연결 | `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: tests/e2e/u4/installation-notifications.spec.ts` |
| NFR6.3 | 연결 | `u3-reminder-workflows: src/web/work-messages.ts`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| NFR6.4 | 연결 | `u3-reminder-workflows: src/web/App.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| NFR7.1 | 연결 | `u3-reminder-workflows: src/web/work-messages.ts`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| NFR7.2 | 연결 | `u3-reminder-workflows: src/web/App.tsx`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceNotifications.kt` |
| NFR7.3 | 연결 | `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| NFR7.4 | 연결 | `u3-reminder-workflows: src/server/repository.ts`, `u4-android-notifications: src/server/http.ts`, `u5-operations-and-recovery: src/server/operations/reporting.ts` |
| NFR7.5 | 연결 | `u3-reminder-workflows: tests/u3/storage-model.test.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceNotifications.kt` |
| NFR8.1 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts`, `u4-android-notifications: src/web/device.ts` |
| NFR8.2 | 연결 | `u3-reminder-workflows: tests/u3/storage-model.test.ts`, `u4-android-notifications: .github/workflows/android-u4-ci.yml`, `u5-operations-and-recovery: tests/u5/backup.test.ts` |
| NFR9.1 | 연결 | `u3-reminder-workflows: tests/u3/occurrence-actions.test.ts`, `u4-android-notifications: tests/u4/notification-rules.test.ts`, `u5-operations-and-recovery: tests/u5/journal.test.ts` |
| NFR9.2 | 연결 | `u3-reminder-workflows: tests/e2e/u3/reminder-workflows.spec.ts`, `u4-android-notifications: .github/workflows/android-u4-ci.yml`, `u5-operations-and-recovery: .github/workflows/u1-app-ci.yml` |
| NFR9.3 | 연결 | `u3-reminder-workflows: vitest.config.ts`, `u4-android-notifications: vitest.config.ts`, `u5-operations-and-recovery: vitest.config.ts` |
| NFR10.1 | 연결 | `u3-reminder-workflows: src/server/http.ts`, `u5-operations-and-recovery: src/server/operations/runtime.ts` |
| NFR10.2 | 연결 | `u3-reminder-workflows: src/server/delete-journal.ts`, `u4-android-notifications: src/server/notification-outbox.ts`, `u5-operations-and-recovery: tests/u5/runtime.test.ts` |
| AC1.1.1 | 연결 | `u1-core-flow: src/server/provider.ts` |
| AC1.1.2 | 연결 | `u1-core-flow: src/server/auth.ts` |
| AC1.1.3 | 연결 | `u1-core-flow: src/server/auth.ts` |
| AC1.2.1 | 연결 | `u1-core-flow: src/server/http.ts` |
| AC1.2.2 | 연결 | `u1-core-flow: src/server/repository.ts` |
| AC1.3.1 | 연결 | `u1-core-flow: src/server/auth.ts` |
| AC1.3.2 | 연결 | `u1-core-flow: src/server/auth.ts` |
| AC1.3.3 | 연결 | `u1-core-flow: src/server/bootstrap-admin.ts` |
| AC1.4.1 | 연결 | `u2-household-and-settings: tests/u2/http.test.ts` |
| AC1.4.2 | 연결 | `u2-household-and-settings: tests/e2e/u2/household-settings.spec.ts` |
| AC1.4.3 | 연결 | `u2-household-and-settings: tests/u2/http.test.ts` |
| AC1.4.4 | 연결 | `u2-household-and-settings: tests/u2/http.test.ts` |
| AC1.5.1 | 연결 | `u2-household-and-settings: tests/u2/repository.test.ts` |
| AC1.5.2 | 연결 | `u2-household-and-settings: tests/u2/repository.test.ts` |
| AC1.5.3 | 연결 | `u2-household-and-settings: tests/u2/repository.test.ts` |
| AC1.6.1 | 연결 | `u1-core-flow: src/server/repository.ts`, `u3-reminder-workflows: src/server/repository.ts` |
| AC1.6.2 | 연결 | `u1-core-flow: src/server/repository.ts`, `u3-reminder-workflows: src/server/repository.ts` |
| AC1.7.1 | 연결 | `u2-household-and-settings: tests/u2/repository.test.ts`, `u3-reminder-workflows: tests/u3/http.test.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC1.7.2 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts` |
| AC1.7.3 | 연결 | `u4-android-notifications: src/server/installations.ts` |
| AC2.1.1 | 연결 | `u1-core-flow: src/server/repository.ts` |
| AC2.1.2 | 연결 | `u1-core-flow: src/server/reminders.ts` |
| AC2.1.3 | 연결 | `u1-core-flow: src/web/App.tsx` |
| AC2.2.1 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.2.2 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC2.2.3 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.3.1 | 연결 | `u3-reminder-workflows: src/server/http.ts` |
| AC2.3.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.3.3 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC2.4.1 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.4.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.4.3 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.5.1 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.5.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.5.3 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts` |
| AC2.6.1 | 연결 | `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC2.6.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC2.6.3 | 연결 | `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC2.6.4 | 연결 | `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC2.7.1 | 연결 | `u3-reminder-workflows: src/web/work-pages.tsx` |
| AC2.7.2 | 연결 | `u3-reminder-workflows: src/server/delete-journal.ts` |
| AC2.7.3 | 연결 | `u3-reminder-workflows: src/server/work-service.ts`, `u4-android-notifications: src/server/installations.ts`, `u5-operations-and-recovery: src/server/operations/restore.ts` |
| AC3.1.1 | 연결 | `u3-reminder-workflows: src/server/recurrence.ts` |
| AC3.1.2 | 연결 | `u3-reminder-workflows: src/server/recurrence.ts` |
| AC3.1.3 | 연결 | `u3-reminder-workflows: src/server/recurrence.ts` |
| AC3.2.1 | 연결 | `u3-reminder-workflows: tests/u3/http.test.ts` |
| AC3.2.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC3.3.1 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts` |
| AC3.3.2 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts` |
| AC3.3.3 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts` |
| AC3.4.1 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC3.4.2 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC3.5.1 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts` |
| AC3.5.2 | 연결 | `u3-reminder-workflows: src/server/work-scheduling.ts` |
| AC4.1.1 | 연결 | `u3-reminder-workflows: src/server/work-input.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.1.2 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.1.3 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.2.1 | 연결 | `u3-reminder-workflows: src/server/work-input.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.2.2 | 연결 | `u3-reminder-workflows: src/server/work-input.ts` |
| AC4.2.3 | 연결 | `u3-reminder-workflows: src/server/work-input.ts` |
| AC4.2.4 | 연결 | `u3-reminder-workflows: src/server/work-input.ts` |
| AC4.3.1 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.3.2 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.3.3 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.4.1 | 연결 | `u4-android-notifications: src/server/installations.ts` |
| AC4.4.2 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceNotifications.kt` |
| AC4.4.3 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceNotifications.kt` |
| AC4.5.1 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts`, `u4-android-notifications: src/server/installation-plans.ts` |
| AC4.5.2 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.5.3 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.6.1 | 연결 | `u1-core-flow: src/server/http.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC4.6.2 | 연결 | `u1-core-flow: tests/e2e/u1/core-flow.spec.ts`, `u4-android-notifications: src/server/installations.ts` |
| AC4.6.3 | 연결 | `u4-android-notifications: src/server/notification-outbox.ts` |
| AC4.6.4 | 연결 | `u1-core-flow: src/web/App.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC4.7.1 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.7.2 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC4.7.3 | 연결 | `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC5.1.1 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.1.2 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.2.1 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.2.2 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.2.3 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.3.1 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.3.2 | 연결 | `u3-reminder-workflows: src/server/repository.ts` |
| AC5.4.1 | 연결 | `u3-reminder-workflows: src/server/work-queries.ts` |
| AC5.4.2 | 연결 | `u3-reminder-workflows: src/server/work-queries.ts` |
| AC5.4.3 | 연결 | `u3-reminder-workflows: src/server/work-queries.ts` |
| AC5.5.1 | 연결 | `u3-reminder-workflows: src/server/work-queries.ts` |
| AC5.5.2 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC5.6.1 | 연결 | `u1-core-flow: src/web/styles.css`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC5.6.2 | 연결 | `u1-core-flow: tests/e2e/u1/core-flow.spec.ts`, `u3-reminder-workflows: src/web/work-pages.tsx` |
| AC5.6.3 | 연결 | `u1-core-flow: tests/e2e/u1/core-flow.spec.ts`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC5.6.4 | 연결 | `u1-core-flow: src/web/App.tsx`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.1.1 | 연결 | `u2-household-and-settings: tests/u2/settings-rules.test.ts`, `u3-reminder-workflows: src/server/work-input.ts`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.1.2 | 연결 | `u2-household-and-settings: tests/e2e/u2/household-settings.spec.ts` |
| AC6.1.3 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.1.4 | 연결 | `u3-reminder-workflows: src/server/work-service.ts` |
| AC6.2.1 | 연결 | `u2-household-and-settings: tests/u2/web-interactions.test.tsx` |
| AC6.2.2 | 연결 | `u2-household-and-settings: tests/e2e/u2/household-settings.spec.ts`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.2.3 | 연결 | `u2-household-and-settings: src/web/App.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.3.1 | 연결 | `u1-core-flow: src/web/messages.ts`, `u2-household-and-settings: src/web/messages.ts`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.3.2 | 연결 | `u2-household-and-settings: src/web/App.tsx`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.3.3 | 연결 | `u1-core-flow: src/server/reminders.ts`, `u2-household-and-settings: tests/e2e/u1/core-flow.spec.ts`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.3.4 | 연결 | `u1-core-flow: src/server/errors.ts`, `u2-household-and-settings: tests/u2/http.test.ts`, `u3-reminder-workflows: src/web/work-pages.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.4.1 | 연결 | `u2-household-and-settings: src/web/Settings.tsx`, `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.4.2 | 연결 | `u4-android-notifications: src/web/InstallationSettings.tsx` |
| AC6.5.1 | 연결 | `u2-household-and-settings: src/server/settings.ts` |
| AC6.5.2 | 연결 | `u2-household-and-settings: prisma/schema.prisma` |
| AC6.5.3 | 연결 | `u2-household-and-settings: src/server/settings.ts` |
| AC6.6.1 | 연결 | `u2-household-and-settings: tests/u2/settings-rules.test.ts` |
| AC6.6.2 | 연결 | `u2-household-and-settings: src/server/households.ts`, `u3-reminder-workflows: src/server/work-effects.ts` |
| AC6.6.3 | 연결 | `u2-household-and-settings: src/server/households.ts`, `u3-reminder-workflows: src/server/work-effects.ts`, `u4-android-notifications: android/app/src/main/java/app/notifyme/client/DeviceSchedule.kt` |
| AC6.7.1 | 연결 | `u2-household-and-settings: tests/u2/settings-rules.test.ts` |
| AC6.7.2 | 연결 | `u3-reminder-workflows: src/server/work-input.ts` |
| AC6.7.3 | 연결 | `u2-household-and-settings: src/server/households.ts`, `u3-reminder-workflows: src/server/work-input.ts` |
| AC6.8.1 | 연결 | `u2-household-and-settings: tests/u2/settings-rules.test.ts` |
| AC6.8.2 | 연결 | `u3-reminder-workflows: src/server/recurrence.ts` |
| AC6.8.3 | 연결 | `u2-household-and-settings: src/server/households.ts`, `u3-reminder-workflows: src/server/work-input.ts` |
| AC7.1.1 | 연결 | `u3-reminder-workflows: src/server/occurrence-actions.ts` |
| AC7.1.2 | 연결 | `u3-reminder-workflows: src/server/occurrence-actions.ts` |
| AC7.1.3 | 연결 | `u3-reminder-workflows: src/server/occurrence-actions.ts` |
| AC7.2.1 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts` |
| AC7.2.2 | 연결 | `u3-reminder-workflows: src/server/work-effects.ts` |
| AC7.2.3 | 연결 | `u3-reminder-workflows: tests/u3/http.test.ts` |
| AC7.2.4 | 연결 | `u3-reminder-workflows: tests/u3/http.test.ts` |
| AC8.1.1 | 연결 | `u5-operations-and-recovery: src/server/operations/reporting.ts` |
| AC8.1.2 | 연결 | `u5-operations-and-recovery: src/server/operations/reporting.ts` |
| AC8.1.3 | 연결 | `u5-operations-and-recovery: src/server/operations/reporting.ts` |
| AC8.2.1 | 연결 | `u5-operations-and-recovery: src/server/operations/runtime.ts` |
| AC8.2.2 | 연결 | `u5-operations-and-recovery: deploy/u5/notify-me.service` |
| AC8.2.3 | 연결 | `u5-operations-and-recovery: tests/u5/runtime.test.ts` |
| AC8.2.4 | 연결 | `u5-operations-and-recovery: src/server/operations/runtime.ts` |
| AC8.3.1 | 연결 | `u5-operations-and-recovery: src/server/operations/backup.ts` |
| AC8.3.2 | 연결 | `u5-operations-and-recovery: src/server/operations/runtime.ts` |
| AC8.3.3 | 연결 | `u5-operations-and-recovery: src/server/operations/archive.ts` |
| AC8.3.4 | 연결 | `u5-operations-and-recovery: deploy/u5/notify-me-backup.timer` |
| AC8.4.1 | 연결 | `u5-operations-and-recovery: src/server/operations/backup.ts` |
| AC8.4.2 | 연결 | `u5-operations-and-recovery: tests/u5/backup.test.ts` |
| AC8.4.3 | 연결 | `u3-reminder-workflows: tests/u3/delete-journal.test.ts`, `u5-operations-and-recovery: src/server/operations/restore.ts` |
| AC8.5.1 | 연결 | `u5-operations-and-recovery: deploy/u5/notify-me.service` |
| AC8.5.2 | 연결 | `u5-operations-and-recovery: src/server/operations/activation.ts` |
| AC8.5.3 | 연결 | `u5-operations-and-recovery: deploy/u5/notify-me.service` |
| AC8.5.4 | 연결 | `u5-operations-and-recovery: deploy/u5/notify-me.service` |
