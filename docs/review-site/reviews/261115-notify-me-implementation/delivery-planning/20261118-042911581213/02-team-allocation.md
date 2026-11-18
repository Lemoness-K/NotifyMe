---
layout: review
title: "Notify Me 작업 책임"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/inception/delivery-planning/team-allocation.md"
permalink: "/reviews/261115-notify-me-implementation/delivery-planning/20261118-042911581213/02-team-allocation/"
---

# Notify Me 작업 책임

## Sources

`unit-of-work.md`, `unit-of-work-story-map.md`, `contract-summary.md`, `team-practices.md`를 기준으로 역할을 배정했다.

Bolt는 완료 기준과 실행 검증을 갖춘 구현 묶음이다. 각 Bolt의 구현 담당은 AI 개발자 역할이다. 사용자는 계획과 확인이 필요한 결과를 승인한다. 실제 외부 계정·장치 사용은 해당 환경의 권한 있는 담당자가 승인한다.

| Bolt | 구현 담당 | 검증에 집중할 부분 | 사람의 참여 |
| --- | --- | --- | --- |
| B1 U1 | aidlc-developer-agent | 최초 Admin과 인증·인가를 통과하는 저장·재조회 | 첫 통합 검증 명령과 결과 확인, 실제 공급자 환경 사용 승인 |
| B2 U2 | aidlc-developer-agent | 초대와 권한 변경, 계정·가구 설정 경계 | 계획에 남은 제품 정책 결정이 필요한 경우 확인 |
| B3 U3 | aidlc-developer-agent | 반복 상태, 이력, 삭제 기록과 오류·재시도 | 완료 검증의 열린 세부 정책 확인 |
| B4 U4 | aidlc-developer-agent | 설치 권한, 시간·장소 알림, 재시작·접근 회수 | 사용 가능한 테스트 기기 승인과 실기기 결과 검토 |
| B5 U5 | aidlc-developer-agent | 격리 복구, 재개 차단, 운영 보고·장애 알림 | 운영 정책과 대상 환경 필요 조건 확인 |

단위별 진행은 순차다. 결함은 해당 기능 담당이 먼저 수정한다. 여러 단위에 걸친 오류는 계약 제공 단위와 소비 단위의 검증 근거를 함께 기록한다.
