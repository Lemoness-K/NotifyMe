---
layout: review
title: "코드 구조 분석"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/code-structure.md"
permalink: "/reviews/261115-notify-me-implementation/reverse-engineering/20261116-103814/03-code-structure/"
---

# 코드 구조 분석

## 현재 저장소 구조

실행 가능한 애플리케이션 코드나 패키지 디렉터리는 발견되지 않았다. 현재 확인되는 프로젝트 산출물은 제품 가이드와 설계 문서다.

| 경로 | 분류 | 현재 역할 |
|---|---|---|
| `AGENT.md` | 프로젝트 안내·운영 규칙 | 제품 범위, 문서 우선순위, 기술·검증·변경 제약 |
| `docs/00-master-design.md` | 제품 기준선 | 목표, 사용자, 기능 트리, MVP와 상위 품질 기준 |
| `docs/01-product-requirements.md` | 요구사항 | 사용자 흐름, 권한, 수용 기준 |
| `docs/02-domain-and-data-design.md` | 도메인·데이터 설계 | 개념 모델, 논리 entity, 불변식 및 상태 |
| `docs/03-system-architecture.md` | 아키텍처 설계 | 목표 runtime·모듈·port/adapter·배포 경계 |
| `docs/04-notification-and-scheduling.md` | 기능 설계 | 시간·장소 Trigger, 회차, 전달 및 동기화 |
| `docs/05-settings-and-feature-configuration.md` | 설정 설계 | Household/User/device scope와 기능 설정 카탈로그 |
| `docs/06-deployment-and-operations.md` | 운영 설계 | Raspberry Pi 배포·백업·복구·운영 체크리스트 |
| `docs/07-security-and-privacy.md` | 보안·개인정보 설계 | 인증·인가, 저장 보호, 데이터 최소화·삭제 |
| `docs/08-test-strategy.md` | 검증 계획 | 구현 후 테스트 범위·환경·개발 루프 기준 |
| `docs/09-feature-design-coverage-and-backlog.md` | 추적표·백로그 | 안정 ID별 설계·구현·테스트 연결 상태 |
| `docs/decision-register.md` | 결정·질문 기준 목록 | `D-NNN` 결정 및 `Q-NNN` 상태 |
| `docs/decisions/` | ADR | 주요 기술·제품 선택의 맥락, 대안, 결과 |
| `docs/designs/` | UX 상세 설계 | 할 일·이력·보관함 흐름 (`DS-005`) |
| `docs/interviews/` | 사용자 인터뷰 이력 | 질문 원문과 답변을 시간순으로 보존 |

## 설계상 예정된 분해

다음은 실제 디렉터리나 source module이 아니라 설계 문서가 제안하는 논리 경계다.

- Identity/Household: 인증 identity 매핑, membership, 초대 및 권한
- Reminder/Occurrence/Recurrence: 업무 정의, 반복 규칙, 수행 회차와 완료 이력
- Settings: 가구·사용자 설정과 설치별 capability 상태
- Sync/Notification: revision/change feed, FCM sync signal, 로컬 Trigger 조정
- Persistence: Prisma repository, SQLite schema와 migration
- Web UI: React Router/Vite SPA
- Android adapters: Kotlin 알람·알림·지오펜싱·권한 adapter
- Runtime/Operations: NestJS API와 Worker, Caddy, systemd/journald

## 소스 분류 및 의존성

현재 코드 파일은 없으므로 Model/Entity, Controller/Handler, Service/UseCase, Repository/DAO, Middleware, Test, Migration, Asset 분류 대상이 없다. 실제 import/export 그래프, 순환 참조 및 internal package dependency도 만들 수 없다. 설계상 목표 의존성 흐름은 Web/API → application/domain 경계 → repository/port이고, 플랫폼·외부 provider adapter는 포트 구현체로 분리하는 것이다.
