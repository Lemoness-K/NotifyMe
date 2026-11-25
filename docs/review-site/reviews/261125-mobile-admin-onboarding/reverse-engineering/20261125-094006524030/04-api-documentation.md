---
layout: review
title: "API 문서"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/api-documentation.md"
permalink: "/reviews/261125-mobile-admin-onboarding/reverse-engineering/20261125-094006524030/04-api-documentation/"
---

# API 문서

## 현재 로그인, 초대와 최초 관리자 경로

다음 HTTP 경로는 `src/server/http.ts`의 `/api/v1` 아래에 있다.

| 경로 | 입력·인증 | 결과·접근 경계 |
|---|---|---|
| `GET /client-config` | 로그인 전 구성 조회 | 웹 공개 SDK 설정 또는 로컬 합성 모드 |
| `POST /sessions/challenges` | 동일 출처 | 난수, 발행 시각, Secure/HttpOnly/SameSite=Strict 챌린지 쿠키 |
| `POST /sessions` | Firebase Bearer, Google 토큰, 챌린지 쿠키 | 앱 세션 쿠키·만료 시각. 검증 실패 또는 미연결 사용자는 401, 인증 공급자 장애는 503 |
| `GET /me` | Firebase Bearer 및 앱 세션 쿠키 | 내부 사용자 ID·표시 이름, 활성 소속이 있을 때 가구 ID·역할·시간대 |
| `DELETE /sessions/current` | 앱 세션, Firebase Bearer, 멱등 키 | 세션 종료 및 쿠키 삭제, 204 |
| `POST /invitations/accept` | 코드, 검증된 Google/Firebase 이메일, 멱등 키 | 가입 가능 여부 검증 및 구성원 등록. 로그인 전 호출하며 이후 일반 세션을 발급 |
| `GET/POST /households/:householdId/invitations` 및 `DELETE /households/:householdId/invitations/:invitationId` | 세션, 가구·역할 확인 | 초대 조회·발행·회수 |
| `GET/POST /households/:householdId/reminders` | 세션, 가구 소속, POST 멱등 키 | 목록 또는 생성 결과 |

- 최초 등록은 `admin:bootstrap`이 담당한다. 최초 후보·확인·취소용 웹 경로는 현재 조사에서 확인되지 않았다.
- `GET /internal/health`는 직접 접속용 내부 경로다. Caddy 프록시 예제에서 404로 차단한다.
- 상태 변경은 정확한 요청 출처와 크기 제한을 적용한다. 오류는 코드와 요청 ID를 반환한다. 초대와 관리 작업에는 별도 요청 제한이 적용된다.

## 기존 설계의 다른 API 경계

회차 처리·이력, 설정, 기기 등록·동기화, outbox 및 작업 임대·재시도를 기존 문서에서 정의한다. 이번 표는 최초 등록 변경과 맞닿은 API만 상세히 표시한다.

## 외부 서비스 경계

Google Identity Services, Firebase Authentication과 서버 SDK가 로그인 증명을 제공·검증한다. FCM은 Android 변경 동기화의 기존 외부 경계다.
