---
layout: review
title: "사용자 스토리 필요성 평가"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/user-stories/user-stories-assessment.md"
permalink: "/reviews/261115-notify-me-implementation/user-stories/20261117-153910340555/03-user-stories-assessment/"
---

# 사용자 스토리 필요성 평가

## 결정

Execute — User Stories 단계를 진행한다.

## 근거

Notify Me는 가구 구성원이 부탁을 등록·배정하고, 시간·장소 알림을 받고, 회차 완료와 이력을 공유하는 사용자 대면 제품이다. Admin과 Member 권한, 요청자·담당자 역할, 반복 규칙, 설치별 Android capability가 함께 작동하므로 요구사항을 사용자 목표와 독립적인 흐름으로 검토할 사용자 스토리가 유용하다.

## 고려한 요소

- 현재 저장소는 실행 코드가 아닌 설계 문서를 보유한 brownfield 프로젝트다.
- 사용자는 household 구성원, Admin, 서비스 운영자 역할을 포함하며 각 역할의 권한과 업무가 다르다.
- 브라우저와 Android 설치가 공유 업무 데이터를 다루고, Android 알림·위치 기능은 설치별 OS capability에 의존한다.
- Reminder 생성·배정·반복·완료·보관, 설정 scope, 현지화, 운영 보고는 여러 화면·모듈 경계를 넘는다.
- Q-063 완료 검증의 세부 정책과 Q-064 운영자 보고·장애 알림 정책은 승인된 기능 범위와 구분해 열린 상태로 보존한다.

## 스토리에서 특히 확인할 영역

- 로그인·가구 가입과 Admin/Member 권한
- Reminder 등록·담당자 지정·반복·시간/장소 알림 및 회차 완료
- 활성 목록·이력·보관함과 변경 결과 공유
- `HOUSEHOLD`, `USER`, `INSTALLATION`, `REMINDER` 설정의 소유 경계와 적용 흐름
- 한국어·영어 선택과 확장 가능한 다국어 UI
- 검증 및 운영 보고·장애 알림 기능의 승인된 범위와 미결정 정책의 경계

## 승인된 스토리 계획

- 가구 구성원을 핵심 페르소나로 두고 요청자·담당자는 작업 맥락, Admin은 권한 변형으로 다룬다. 서비스 운영자는 별도 페르소나다.
- 스토리는 승인된 사용자 여정·업무 흐름별로 묶고, 각 항목은 INVEST 기준에 맞춰 독립적인 사용자 결과와 Given/When/Then 수용 기준으로 표현한다.
- MoSCoW 우선순위는 Delivery Planning의 공식 MVP 경계 결정을 돕는 입력으로 사용한다.
- Q-063과 Q-064의 세부 정책은 승인 전까지 열린 상태로 유지한다.
