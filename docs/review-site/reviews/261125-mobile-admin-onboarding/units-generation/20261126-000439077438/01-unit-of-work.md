---
layout: review
title: "모바일 최초 관리자 등록 구현 단위"
source_path: "aidlc/spaces/default/intents/261125-mobile-admin-onboarding/inception/units-generation/unit-of-work.md"
permalink: "/reviews/261125-mobile-admin-onboarding/units-generation/20261126-000439077438/01-unit-of-work/"
---

# 모바일 최초 관리자 등록 구현 단위

[요구사항](../requirements-analysis/requirements.md), [구성요소](../domain-design/components.md), [설계 결정](../domain-design/decisions.md)에 따른 단일 서비스 변경이다.

| Unit ID | Directory | 종류 | 배포 모델 | 복잡도 |
|---|---|---|---|---|
| U1 | u1-mobile-admin-onboarding | service | 기존 Raspberry Pi 서비스와 공유 | M |

## U1 모바일 최초 관리자 등록

- **구성요소** `SetupWeb`, `FirstAdminOnboarding`, `InstallationSetupAuthority`, `IdentitySession`, `HouseholdMembership`, `OperationsLifecycle`.
- **책임** 모바일 계정 확인·취소, 짧은 후보 유효기간·재시도, 첫 가구와 관리자의 원자적 등록, 새 설치의 명시적 허용과 장애 시 차단, 기존 로그인·초대 호환성.
- **배포 범위** 같은 Raspberry Pi의 기존 Web UI·API·SQLite·운영 경로를 함께 변경한다. 코드, 마이그레이션, 설정 준비 및 복원 동작, 테스트, 관련 제품·운영 문서는 한 변경에서 검증한다.
- **문서 정합성** `D-074` 최초 관리자 CLI 이력에서 새 결정으로 연결한다. `Q-048` 첫 가구·관리자 등록, `Q-071` 최초 설정 접근 범위, `DS-003` 계정·가구 온보딩, `F-HH-001` 초기 가구 설정, `PR-AC-058` 최초 관리자 수용 기준과 보안·추적표·운영 가이드를 갱신한다.
- **검증 경계** 취소·닫기·새로고침·다중 탭·계정 전환·응답 유실, 두 계정의 경쟁, DB 장애·복원·종료·설치 주기 변경, 기존 DB 로그인과 초대를 합성 통합 데이터로 확인한다. Pi 실기기 증거는 안드로이드 Chrome에서 Wi-Fi를 끄고 수집한다. 운영 DB에서 파괴적 검증에는 별도 승인이 필요하다.

## 기능 설계에 넘길 검증 조건

- 운영자가 의도적으로 준비한 설정 주기마다 성공은 한 번이다. 재설정 이후에는 이전 후보 확인을 거부한다.
- 상태가 커밋된 뒤 브라우저가 응답을 잃어도 새 등록을 열지 않는다. 성공한 같은 계정이 재시도하면 같은 가구로 이어진다.
- 최종 확인을 DB 전환·복원·가구 종료 및 설치 주기 변경과 직렬화한다. 이전 DB에 등록하거나 그 성공을 반환하지 않도록 양쪽 순서를 테스트한다.
- 표시한 후보와 현재 서버가 검증한 계정이 일치할 때만 상태 변경을 허용한다. 새로고침·계정 전환·증명 소실의 안전한 복귀 동작을 명시한다.
