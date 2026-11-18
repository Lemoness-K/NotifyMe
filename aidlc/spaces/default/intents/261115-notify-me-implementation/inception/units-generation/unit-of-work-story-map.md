# 작업 단위별 스토리 배정

## Sources

승인된 도메인 설계의 `components.md`, `decisions.md`와 `requirements.md`, `stories.md`를 기준으로 작성했다.

| Story | Unit ID | Directory | 구현 책임 |
| --- | --- | --- | --- |
| US1.1 | U1 | u1-core-flow | 인증과 내부 사용자 |
| US1.2 | U1 | u1-core-flow | 단일 가구와 데이터 격리 |
| US1.3 | U1 | u1-core-flow | 초기 가구와 최초 Admin |
| US1.4 | U2 | u2-household-and-settings | 초대와 가입 |
| US1.5 | U2 | u2-household-and-settings | 역할과 마지막 Admin |
| US1.6 | U3; U1 | u3-reminder-workflows; u1-core-flow | U1 기본 접근과 생성·조회, U3 공동 변경과 완료 |
| US1.7 | U2; U3; U4 | u2-household-and-settings; u3-reminder-workflows; u4-android-notifications | U2 접근 회수, U3 배정 종료·이력 보존, U4 설치 정리 |
| US2.1 | U1 | u1-core-flow | 제목·설명과 최초 등록 |
| US2.2 | U3; U4 | u3-reminder-workflows; u4-android-notifications | U3 담당자·요청자·감사, U4 설치 대상 |
| US2.3 | U3 | u3-reminder-workflows | 공유 업무 상세와 수정 |
| US2.4 | U3 | u3-reminder-workflows | 회차 완료 |
| US2.5 | U3 | u3-reminder-workflows | 완료 취소 |
| US2.6 | U3; U4 | u3-reminder-workflows; u4-android-notifications | U3 보관·복원, U4 예약 정리와 복구 |
| US2.7 | U3; U4; U5 | u3-reminder-workflows; u4-android-notifications; u5-operations-and-recovery | U3 영구 삭제와 표지, U4 기기 반영, U5 복구 시 삭제 유지 |
| US3.1 | U3 | u3-reminder-workflows | 반복 규칙 |
| US3.2 | U3 | u3-reminder-workflows | 회차별·시리즈별 편집 |
| US3.3 | U3 | u3-reminder-workflows | 회차와 리마인더 수명주기 |
| US3.4 | U3; U4 | u3-reminder-workflows; u4-android-notifications | U3 무담당 회차, U4 예약 중단과 재개 |
| US3.5 | U3 | u3-reminder-workflows | 회차 건너뛰기 |
| US4.1 | U4; U3 | u4-android-notifications; u3-reminder-workflows | U3 시간 조건, U4 시간 알림 |
| US4.2 | U4; U3 | u4-android-notifications; u3-reminder-workflows | U3 장소 조건, U4 지오펜스 |
| US4.3 | U4 | u4-android-notifications | 권한과 복구 |
| US4.4 | U4 | u4-android-notifications | 담당 설치와 변경 신호 |
| US4.5 | U4; U3 | u4-android-notifications; u3-reminder-workflows | U3 원자적 저장, U4 설치 용량 검증과 계획 |
| US4.6 | U4; U1 | u4-android-notifications; u1-core-flow | U1 웹과 API, U4 Android 반영 |
| US4.7 | U4 | u4-android-notifications | 기기 상태 변화 후 재조정 |
| US5.1 | U3 | u3-reminder-workflows | 내 할 일 |
| US5.2 | U3 | u3-reminder-workflows | 요청한 일 |
| US5.3 | U3 | u3-reminder-workflows | 가구 전체 할 일 |
| US5.4 | U3 | u3-reminder-workflows | 완료·변경 이력 |
| US5.5 | U3 | u3-reminder-workflows | 보관함 |
| US5.6 | U1; U3; U4 | u1-core-flow; u3-reminder-workflows; u4-android-notifications | U1 공유 UI와 포트, U3 업무 화면, U4 Android 기능 연결 |
| US6.1 | U2; U3; U4 | u2-household-and-settings; u3-reminder-workflows; u4-android-notifications | U2 가구·계정과 카탈로그, U3 Reminder, U4 설치 값 |
| US6.2 | U2; U4 | u2-household-and-settings; u4-android-notifications | U2 언어 저장과 우선순위, U4 Android 적용 |
| US6.3 | U2; U1; U3; U4 | u2-household-and-settings; u1-core-flow; u3-reminder-workflows; u4-android-notifications | U2 번역 체계, U1 구조적 오류, U3 업무 표현, U4 시스템 문구 |
| US6.4 | U4; U2 | u4-android-notifications; u2-household-and-settings | U2 설정 구획, U4 OS 권한 상태 |
| US6.5 | U2 | u2-household-and-settings | 카탈로그 메타데이터·저장과 수명주기 |
| US6.6 | U2; U3; U4 | u2-household-and-settings; u3-reminder-workflows; u4-android-notifications | U2 정책, U3 원자적 반경 조정·이력, U4 예약 갱신 |
| US6.7 | U2; U3 | u2-household-and-settings; u3-reminder-workflows | U2 상한 설정, U3 입력 검증 |
| US6.8 | U2; U3 | u2-household-and-settings; u3-reminder-workflows | U2 달력 기준 설정, U3 규칙 생성 시 보존 |
| US7.1 | U3 | u3-reminder-workflows | 선택적 완료 검증 설정 |
| US7.2 | U3 | u3-reminder-workflows | 완료 승인·거절 |
| US8.1 | U5 | u5-operations-and-recovery | 주간 운영 보고와 장애 알림 |
| US8.2 | U5 | u5-operations-and-recovery | 상태와 로그 진단 |
| US8.3 | U5 | u5-operations-and-recovery | 일관된 암호화 백업 |
| US8.4 | U5; U3 | u5-operations-and-recovery; u3-reminder-workflows | U3 삭제 표지, U5 복구·재적용·검증 |
| US8.5 | U5 | u5-operations-and-recovery | 서비스 시작·업데이트·마이그레이션 |

## Coverage and Verification

- 스토리 47개를 각각 한 행에 배정했다. 각 작업 단위는 하나 이상의 스토리를 구현한다. 추적표는 각 행의 첫 단위를 대표 연결로 사용한다.
- 스토리에 여러 단위가 적혀 있으면 각 단위의 Functional Design에서 해당 스토리의 전체 수용 기준을 추적하되 위 표의 구현 책임과 통합 검증 담당을 구분한다.
- 각 단위에서는 입력과 데이터 계약, 정상 흐름, 오류·재실행 처리, 적용되는 화면·설치 검증을 연결한다. 접근 회수, 반경 조정·예약 갱신, 삭제 표지 재적용은 통합 흐름에서 확인한다.
