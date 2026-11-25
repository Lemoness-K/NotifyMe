---
layout: review
title: "구성요소 목록"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/component-inventory.md"
permalink: "/reviews/261125-mobile-admin-onboarding/reverse-engineering/20261125-094006524030/05-component-inventory/"
---

# 구성요소 목록

## 설계 문서 저장소

제품 기준, 안정 ID, ADR과 운영 안내가 있다. 제품 추적표는 이번 후속 작업에서 실제 구현·테스트를 연결할 대상이다.

## 공유 Web UI

- `src/web/client.ts`가 웹 Google/Firebase 인증과 동일 출처 요청을 연결한다.
- 결과를 공유 React UI에 전달한다. 브라우저의 Firebase 인증은 메모리 지속성을 쓰며, Android bridge 경로가 따로 있다.

## Android 앱 셸 및 플랫폼 adapter

이전 설계에서 공유 UI, 알람·시스템 알림·지오펜스와 권한 기능을 담당한다. 이번 집중 분석에서는 웹 클라이언트의 경계만 확인했다.

## NestJS API 및 업무 모듈

`src/server/auth.ts`는 인증 증명과 내부 사용자 연결을 처리한다. `provider.ts`가 Google/Firebase 검증을 수행한다. `bootstrap-admin.ts`는 최초 등록 CLI를 연결하고 `http.ts`는 브라우저 세션·가구 작업·초대 API를 제공한다.

## 단일 Worker 및 동기화 경계

이전 설계에서 반복 회차, 작업 점유, 변경 revision과 전달 재시도를 담당한다. 관리형 앱 시작에서 작업은 서빙 상태 발행 이후 기동한다.

## Prisma 저장소 및 SQLite

`storage.ts`, Prisma schema와 SQL migration이 저장 경계다. 최초 가구의 `singleton` 값 제약과 고유 인덱스, 사용자·가구 조합의 멤버십 기본 키를 사용한다.

## Caddy ingress

`deploy/u1/Caddyfile.example`은 같은 출처의 정적 SPA·API를 제공하고 내부 경로를 차단한다. Tailscale 가이드는 Serve가 이 Caddy 앞에서 TLS를 종료하는 구성을 설명한다.

## Raspberry Pi 운영 환경

U5 운영 예제는 systemd, 로컬 소켓, 별도 권위 원장, 백업과 복구를 설명한다. 현재 분석은 설정·예제·운영 코드에 한정하며 운영 환경의 설정 및 계정은 열지 않았다.

## 관리형 활성화와 복구

`src/server/operations/activation.ts`, `runtime.ts`, `restore.ts`가 상태 파일과 SQLite 세대, 검증된 후보 DB, 권위 원장 조건을 연결한다. 복구 중 API와 작업 기동이 보류된다.
