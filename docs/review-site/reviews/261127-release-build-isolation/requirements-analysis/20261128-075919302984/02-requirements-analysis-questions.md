---
layout: review
title: "DS-030 요구사항 분석 — 확인할 범위"
source_path: "aidlc/spaces/default/intents/261127-release-build-isolation/inception/requirements-analysis/requirements-analysis-questions.md"
permalink: "/reviews/261127-release-build-isolation/requirements-analysis/20261128-075919302984/02-requirements-analysis-questions/"
---

# DS-030 요구사항 분석 — 확인할 범위

## Sources

- [desc] Initial description: 사용자가 선택한 Notify Me DS-030을 진행해줘. `aidlc engine workspace project-description`의 원문이다. 최초 요청의 전체 조건은 [앞 단계 근거](../practices-discovery/evidence.md#사용자-최초-요청-원문)에 보존되어 있다.
- [scope] Workflow-selected scope: infra. 작업 계획 선택과 실제 서비스 전환 승인은 구분한다.
- [memory:M1] [승인된 작업 방식](../practices-discovery/team-practices.md): 데이터·다른 세션 작업 보존, TDD와 synthetic 임시 DB, 전체 line coverage 80%, 실제 전환 별도 승인.
- 기준 문서: 프로젝트 루트 `docs/09-feature-design-coverage-and-backlog.md`의 DS-030·§8.8·§8.9, `docs/06-deployment-and-operations.md` §7, `docs/decision-register.md` D-070(환경 분리)·D-071(테스트 우선)·D-077(systemd)·D-104(DS-027 화면 수용)·D-105(DS-030 선택).
- DocumentKB: `01a22019-2917-70d6-81f5-9cdf6cba3a07`, 원본 사본 SHA-256 `29e479305cb6235e9c48483234dcdc76619b1ae26dda5570092f1ae129f02372`. 전체 추출은 200000자에서 잘려 대상 절은 사본의 832–840, 937–947, 1038–1055행에서 별도 확인했다. 원본 문서는 변경하지 않았다.
- 기존 구조 참고: `aidlc/spaces/default/codekb/toyproj_notify_me/business-overview.md`, `architecture.md`, `code-structure.md`. 과거 온보딩 사실은 최신 D-099(모바일 최초 관리자)와 앞 단계 런타임 증거를 우선하며 새로운 기능 범위로 확대하지 않는다.

## 분석 결과

이번 사용자의 목표·보존 조건·수용 기준·결과 반환 범위는 이미 명확하다. 같은 결정을 다시 묻는 일반 질문은 만들지 않는다. 기술적 구체값은 아래 후속 결정 조건에 남기고, 여기서는 검증 가능한 요구사항의 경계만 확인한다. 제품의 기존 열린 질문과 안정 ID는 바꾸지 않는다.

| 완전성 관점 | 이번 작업에서 다루는 내용 |
|---|---|
| 기능 | 격리 build·고정 릴리스·웹/API 명시적 전환과 복구 |
| 비기능 | 산출물 불변성, 영속 데이터·비밀 보호, systemd 자동 시작, 오류 시 복구 근거 |
| 사용자 시나리오 | 개발 build 중 기존 화면 유지, 승인 버전 전환, 실패·불일치·이전 버전 복구 |
| 가치·범위 | 가족이 쓰는 웹/API의 의도치 않은 변경 방지. 자동 배포 확대·제품 기능 추가 제외 |
| 기술 경계 | 개발 checkout, 별도 작업 복사본, API 실행 파일, Caddy·Node webRoot, 기존 영속 DB·키·백업 |
| 검증 품질 | TDD·typecheck·관련 unit/API/E2E, 전체 coverage 기준, 현재 경로·해시·버전 근거와 미수행 구분 |

## 후속 결정 조건

- 전환 중 허용 중단 시간과 복구 목표, 최종 릴리스 경로·권한·서비스 설정, 전환·복구 명령과 관찰 방법은 NFR·인프라·배포 설계에서 구체안을 준비한다. 값이나 구현 방식이 이미 승인됐다고 가정하지 않는다.
- 현재 실행 중 API와 공유 웹 파일이 같은 고정 build라는 보장은 없다. 기존 DS-027 화면을 보존하는 기준선과 롤백 대상은 전환 전에 재확인해야 한다.
- 요구사항 승인만으로 서비스 이동·재시작·프록시 reload를 실행하지 않는다. 실제 적용은 검증·구체 복구 절차와 별도의 사용자 승인이 갖춰진 뒤 수행한다.

## Consolidated Summary Confirmation

- 개발·테스트 작업 복사본과 build 산출물·API 실행 경로·웹 root를 사용 릴리스에서 분리한다. 분리 전 현재 공유 dist에서는 build·verify:u1을 실행하지 않는다.
- 별도 작업 복사본에서 build·관련 unit/API/E2E를 실행한 전후 사용 웹 asset hash·서비스 실행 경로·DB 대상이 유지되는지 검증한다. 테스트는 synthetic fixture·임시 SQLite·fake provider만 사용한다.
- 웹과 API를 같은 검증 버전으로 식별하고 고정 릴리스로 준비한다. 산출물에 비밀·실사용 DB·개인정보를 포함하지 않고, 준비가 끝나기 전에는 사용 경로를 바꾸지 않는다.
- 구체적인 전환·복구 계획을 준비하고 승인된 범위에서 웹/API를 함께 전환한다. 실패·버전 불일치 때 성공으로 보고하지 않으며 기존 데이터에 접근 가능한 이전 릴리스 복구 근거를 확보한다.
- 데이터·계정·주소·보호 키·권위 볼륨·백업·DS-027 화면과 타 세션 미커밋 작업을 보존한다. systemd 자동 시작과 기존 접근 경계를 유지한다.
- 운영 원본·임시 제약·배포 가이드·ID 추적을 실제 검증 결과와 맞추고, 변경 파일·검증 명령/결과·미수행·실제 적용 버전·복구 근거·잔여 작업을 로드맵 세션에 반환한다. 기존 제약은 분리 확인 후 갱신한다.
- 새 제품 기능·자동 배포 확대·추가 유료 인프라·공개 범위 확대·운영 DB 초기화·스키마 변경은 이번 범위에 자동 포함하지 않는다. 최종 경로·권한·중단 허용 시간·복구 목표는 후속 설계의 결정 조건으로 남긴다.

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
