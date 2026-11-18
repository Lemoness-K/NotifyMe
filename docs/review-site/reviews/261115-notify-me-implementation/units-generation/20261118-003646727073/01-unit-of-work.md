---
layout: review
title: "Notify Me 구현 작업 단위"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/units-generation/unit-of-work.md"
permalink: "/reviews/261115-notify-me-implementation/units-generation/20261118-003646727073/01-unit-of-work/"
---

# Notify Me 구현 작업 단위

## Sources

승인된 도메인 설계의 `components.md`, `decisions.md`와 `requirements.md`, `stories.md`를 기준으로 작성했다.

## Unit Definitions

| Unit ID | Directory | Kind | Deployment | Complexity | 범위 |
| --- | --- | --- | --- | --- | --- |
| U1 | u1-core-flow | service | 공유 서버·공유 웹 | M | 실제 웹·API·SQLite에서 초기 가구, 인증, 리마인더 등록·조회 |
| U2 | u2-household-and-settings | service | 공유 서버에 포함 | M | 초대·역할·접근 회수, 가구·계정 값과 설정 카탈로그 |
| U3 | u3-reminder-workflows | service | 공유 서버에 포함 | L | 담당자·조건·반복·회차·완료 검증·목록·이력·보관·삭제 |
| U4 | u4-android-notifications | service | Android 앱과 공유 서버의 동기화 모듈 | L | 설치 등록과 권한, 동기화와 시간·장소 알림 |
| U5 | u5-operations-and-recovery | service | 운영 작업 및 Raspberry Pi 실행 구성 | L | 상태·보고·장애 알림, 백업·복구, 실행·업데이트 |

복잡도는 상대 추정치다. 서버 단위는 기존 모듈형 모놀리스와 공유 SQLite 안에서 실행하며, 각 기능 단위에서 같은 웹 UI에 필요한 화면을 추가한다.

## Unit Responsibilities

- **U1 최소 통합 흐름.** 초기 가구와 최초 Admin을 준비하고, 내부 사용자·가구 권한으로 웹에서 리마인더를 등록하고 조회한다. 승인된 필드와 기본값을 사용한다. API와 실제 SQLite를 연결해 재시작 뒤에도 해당 데이터를 조회할 수 있게 한다. 검증용 인증 환경과 통합 확인 명령은 Delivery Planning에서 확정한다.
- **U2 가구와 설정.** 일회용 초대, 구성원 역할, 마지막 Admin 보호와 접근 회수 상태를 정의한다. 설정 카탈로그와 가구·사용자 값을 관리하고 한국어·영어 및 표시 시간대 기반을 제공한다. 설치와 Reminder 값은 각 경계에서 관리한다.
- **U3 리마인더 업무.** 업무 수명주기, 반복·회차·완료 검증과 사용자 이력을 담당한다. 여러 모듈의 쓰기가 필요한 서버 명령을 조정한다. 구성원 접근 회수와 배정 종료, 반경 정책과 기존 Trigger 변경은 같은 서버 트랜잭션에서 처리한다. 설치 계획을 묶을 수 있는 진입점과 최소 삭제 표지를 제공한다.
- **U4 Android 알림과 동기화.** 서버 대상 상태를 설치에 반영한다. FCM은 변경 신호를 보내고 OS가 실제 알림을 실행한다. 위치 용량 검사와 설치 예약 계획을 U3 명령에 연결한다. 가구 회수 신호 또는 후속 가구 접근 거부를 받으면 기기의 해당 캐시·로컬 예약·지오펜스를 정리한다.
- **U5 운영과 복구.** 운영 진단, 선택적 보고·장애 알림, 서비스 실행 구성과 백업·복구 작업을 제공한다. 복구할 백업을 되돌려도 보존되는 경계에서 최신 삭제 표지를 확보하고 재적용·검증을 마친 뒤 데이터 제공을 허용한다. 배포 대상과 자격 증명은 기존 작업 범위와 운영 설계를 따른다.

## Boundary Rationale

기능을 관통하는 단위는 사용자 흐름을 실행해 확인할 수 있다. UI·API·데이터별 분할은 소유 역할을 단순하게 하지만 검증할 때 세 작업이 모두 필요하다. 서버를 독립 배포로 나누면 장애를 분리할 수 있지만 가구·업무·예약 변경을 함께 저장하기 어렵고 Raspberry Pi 운영 부담이 커진다. 각 기능의 소유권을 공유 서버 안에서 유지한다. 열린 질문은 결정 등록부에서 추적한다.
