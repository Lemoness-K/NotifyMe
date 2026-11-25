---
layout: review
title: "코드 구조 분석"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/code-structure.md"
permalink: "/reviews/261125-mobile-admin-onboarding/reverse-engineering/20261125-094006524030/03-code-structure/"
---

# 코드 구조 분석

## 현재 저장소 구조

| 경로 | 분류 | 역할 |
|---|---|---|
| `src/server/auth.ts`, `provider.ts`, `bootstrap-admin.ts` | 인증 서비스, 제공자, CLI | 최초 등록, 챌린지·세션, Google/Firebase 검증 |
| `src/server/http.ts`, `main.ts`, `config.ts` | API·기동·구성 | NestJS 경로, 보안 요청 경계, 모드와 저장 경로 |
| `src/server/storage.ts`, `prisma/schema.prisma`, `prisma/migrations/` | 저장소·스키마·마이그레이션 | Prisma/SQLite와 로컬·복구용 SQL 경로 |
| `src/server/operations/` | 운영 서비스 | SQLite 세대, 활성화, 복원 및 운영 소켓 |
| `src/web/client.ts`, `App.tsx`, `messages.ts` | API 클라이언트·화면·언어 자원 | 로그인→프로필→인증 화면 전환, 초대 분기, 리마인더 |
| `deploy/u1/`, `deploy/u5/`, `docs/u1-local-run.md` | 배포 예제·운영 문서 | Caddy, systemd 및 운영/복구 절차 |
| `tests/u1/`, `tests/u2/`, `tests/u5/`, `tests/e2e/u1/` | 테스트 | 기존 CLI·세션·초대·복구와 Chromium 증거 |

`docs/`는 마스터 설계, 요구사항, 도메인·아키텍처, 설정·알림, 보안·운영, 수용 기준·추적표, ADR·인터뷰를 구분한다.

## 소스 분류 및 의존성

`bootstrap-admin.ts` → `config.ts` / `storage.ts` / `auth.ts`. `config.ts` → `provider.ts` 및 알림 경계. `auth.ts` → Prisma 자료 형식 / 오류 / 저장소 오류 코드 분류. `web/client.ts` → Firebase SDK 또는 Android bridge와 `/api/v1`. `main.ts` → Nest 앱·저장소·관리형 운영. 운영 복원은 `activation.ts`·삭제 원장·백업 및 저장소를 사용한다.

## 이전 설계의 모듈 경계

Identity/Household, Reminder/Occurrence/Recurrence, Settings, Sync/Notification, Persistence, Web UI, Android adapters, Runtime/Operations 구분은 이전 설계에서 가져왔다. Android와 알림 도메인의 세부 의존성 및 순환 참조는 이번 조사 범위에 포함하지 않았다.
