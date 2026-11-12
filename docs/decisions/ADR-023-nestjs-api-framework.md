# ADR-023: Node.js API framework로 NestJS 사용

- 상태: 승인
- 날짜: 2026-11-08
- 관련 결정: `D-052`, `D-053`, `D-055`, `D-056`
- 해결한 질문: `Q-016`
- 관련 요구사항: `PR-AC-031`, `PR-AC-043`, `PR-AC-044`
- 관련 문서: [마스터 설계](../00-master-design.md), [시스템 아키텍처](../03-system-architecture.md)

## 맥락

Node.js는 JavaScript/TypeScript 서버 코드를 실행하는 runtime이다. Node.js 기본 HTTP API로
웹 서버를 직접 만들 수 있지만, 그 API는 낮은 수준이므로 routing과 애플리케이션 구조를
직접 구성해야 한다([Node.js HTTP API](https://nodejs.org/api/http.html)).

Notify Me 서버에는 인증·가구 권한, reminder·occurrence, 반복 규칙, 설정, 변경 이력,
작업 실행과 FCM outbox 등 여러 기능 경계가 있다. 웹 개발 초심자가 구조를 유지할 수 있고,
기능 추가 시 모듈 경계를 명확히 할 서버 framework가 필요하다.

NestJS는 Node.js에서 실행되는 TypeScript 서버 framework이며, 모듈과 provider 의존성 주입으로
기능을 나누는 관례를 제공한다. NestJS는 내부 HTTP 처리를 위해 Express를 기본 사용하고,
Fastify 또는 Node.js 기본 HTTP API adapter도 지원한다([NestJS 개요와 플랫폼](https://docs.nestjs.com/first-steps),
[NestJS modules](https://docs.nestjs.com/modules)).

## 결정

- API 서버 runtime은 Node.js, 애플리케이션 framework는 NestJS로 한다(`D-055`).
- 서버는 Raspberry Pi에서 운영하는 단일 모듈형 모놀리스로 구성한다. NestJS 선택은 마이크로서비스 도입을 뜻하지 않는다.
- 기능은 Identity/Household, Reminder/Occurrence/Recurrence, Settings, Sync/Notification 등 경계를 따라 NestJS feature module로 구성한다.
- HTTP controller와 NestJS provider는 API 및 애플리케이션 경계에 둔다. 도메인 규칙과 entity는 NestJS decorator, Express/Fastify request 타입, DB ORM 타입에 의존하지 않는다.
- SQLite ORM/query layer는 Prisma ORM 7로 정했다(`D-056`, [ADR-024](./ADR-024-prisma-orm-sqlite-access.md)).
- 초기 구현은 NestJS의 기본 HTTP adapter로 시작하고, 다른 adapter 선택은 구현 검증에서 필요성이 확인될 때 검토한다.

## 결과

### 장점

- feature module로 관련 API와 provider를 묶어 코드 위치와 책임을 찾기 쉽다.
- 모듈 간 공개 provider를 명시해 기능 간 결합을 제한할 수 있다.
- TypeScript 기반 UI/API가 같은 주요 언어를 사용한다(`D-052`).

### 고려할 점

- module, controller, provider, decorator, dependency injection 등 Express 단독보다 더 많은 개념과 boilerplate를 학습해야 한다.
- NestJS abstraction과 ORM abstraction이 도메인 로직에 섞이지 않도록 경계를 유지해야 한다.
- 실제 Raspberry Pi Node.js 버전과 NestJS 지원 범위는 구현 착수 시 확인한다.

## 고려한 대안

- **Node.js 기본 HTTP API만 사용**: 추가 framework 의존성을 줄이지만, 이 프로젝트에 필요한 라우팅·검증·기능 구조를 직접 구성·유지해야 하므로 채택하지 않는다.
- **Express 단독**: middleware와 routing이 간단하고 유연하지만, 인증·검증·의존성 관리·feature 구조의 관례를 프로젝트가 직접 정해야 하므로 이번 학습·확장 목표에는 NestJS를 우선한다([Express middleware](https://expressjs.com/en/guide/using-middleware/)).
- **Fastify 단독**: plugin encapsulation과 TypeScript 지원이 좋고 가벼운 선택이지만, NestJS보다 애플리케이션 레이어 구조를 직접 선택해야 하므로 채택하지 않는다([Fastify plugins](https://fastify.dev/docs/latest/Reference/Plugins/)).

## 재검토 조건

NestJS와 Node.js의 버전 호환성, Raspberry Pi 자원 사용, 개발·운영 복잡도에서 실제 문제가
확인되거나 단일 서비스의 요구와 구조가 크게 달라지면 재검토한다. 성능 향상이 필요하다는
막연한 예상만으로 framework를 교체하지 않는다.
