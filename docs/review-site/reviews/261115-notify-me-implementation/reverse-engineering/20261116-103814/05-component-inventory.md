---
layout: review
title: "구성요소 목록"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/component-inventory.md"
permalink: "/reviews/261115-notify-me-implementation/reverse-engineering/20261116-103814/05-component-inventory/"
---

# 구성요소 목록

이 저장소의 아래 항목은 코드에서 발견한 구현 구성요소가 아니라 설계에 기록된 제품·운영 경계다. 배포 가능한 소프트웨어는 아직 확인되지 않았다.

## 설계 문서 저장소

- **책임**: 요구사항·도메인·아키텍처·운영·보안·검증 정책과 ADR을 관리한다.
- **의존성**: 안정 ID와 문서 간 링크를 통해 상위 기준과 세부 설계를 연결한다.
- **상태**: 구현 산출물 없음.

## 공유 Web UI

- **책임**: 브라우저와 Capacitor WebView에서 Reminder·목록·이력·설정 UI 제공.
- **기술 계획**: React Router + Vite SPA, TypeScript.
- **의존성 계획**: NestJS HTTP API와 platform-neutral capability ports.
- **상태**: 설계만 존재.

## Android 앱 셸 및 플랫폼 adapter

- **책임**: 공유 UI를 담고 로컬 알람·시스템 알림·geofence·권한 기능 제공.
- **기술 계획**: Capacitor shell 및 capability별 Kotlin adapter.
- **의존성 계획**: Android OS 기능, 공유 UI bridge, 서버 동기화.
- **상태**: 설계만 존재.

## NestJS API 및 업무 모듈

- **책임**: 인증·인가, 가구와 Reminder 업무, 설정, API 계약 제공.
- **기술 계획**: Node.js runtime, NestJS feature modules, 모듈형 모놀리스.
- **의존성 계획**: identity provider, domain/application 경계, persistence repository.
- **상태**: 설계만 존재; endpoint 구현은 없음.

## 단일 Worker 및 동기화 경계

- **책임**: 반복 회차 생성, due 작업 점유, outbox/retry, 변경 revision 및 기기 동기화 지원.
- **의존성 계획**: 업무 모듈, SQLite job lease/outbox, FCM ChangeSignal adapter.
- **상태**: 설계만 존재.

## Prisma 저장소 및 SQLite

- **책임**: 서버 데이터와 migration을 관리하는 persistence boundary.
- **기술 계획**: Prisma ORM 7, `@prisma/adapter-better-sqlite3`, SQLite.
- **의존성 계획**: NestJS API 및 Worker. Prisma 타입은 domain에 노출하지 않도록 설계됨.
- **상태**: schema·migration·DB 파일 없음.

## Caddy ingress

- **책임**: HTTPS 종료, React 정적 build 제공, NestJS API reverse proxy.
- **의존성 계획**: DDNS hostname, 외부 TCP 80/443 도달성, RPi 내부 API.
- **상태**: 설계만 존재; 실제 hostname·route 설정 없음.

## Raspberry Pi 운영 환경

- **책임**: API/Worker 자동 시작과 재시작, 로그·상태 점검, 백업 및 복구.
- **기술 계획**: systemd, journald, 로컬 헬스체크, 암호화된 외부 백업.
- **상태**: 문서상 체크리스트이며 실제 호스트 설정은 발견되지 않음.
