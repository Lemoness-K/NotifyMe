---
layout: review
title: "구현 단위 요구사항 연결"
source_path: "aidlc/spaces/default/intents/261125-mobile-admin-onboarding/inception/units-generation/unit-of-work-story-map.md"
permalink: "/reviews/261125-mobile-admin-onboarding/units-generation/20261126-000439077438/03-unit-of-work-story-map/"
---

# 구현 단위 요구사항 연결

[요구사항](../requirements-analysis/requirements.md)과 [구성요소](../domain-design/components.md), [설계 결정](../domain-design/decisions.md)에 따라 수용 기준 전체를 한 단위에 배정한다.

| 요구사항 | Unit ID | Directory | 단위의 검증 |
|---|---|---|---|
| FR11.1 | U1 | u1-mobile-admin-onboarding | 준비된 설치에서 서버가 최초 검증 후보 한 명을 고른다. |
| FR11.2 | U1 | u1-mobile-admin-onboarding | 좁은 Chrome 화면에 계정·문구·설정 시작·취소가 있다. |
| FR11.3 | U1 | u1-mobile-admin-onboarding | 원자적 등록 후 같은 로그인으로 리마인더를 저장한다. |
| FR11.4 | U1 | u1-mobile-admin-onboarding | 취소, 새로고침, 만료 및 중복 재시도를 처리한다. |
| FR11.5 | U1 | u1-mobile-admin-onboarding | 기존 DB 로그인과 이메일 지정 초대를 유지한다. |
| FR11.6 | U1 | u1-mobile-admin-onboarding | 운영 가이드에서 첫 설정과 재설정, 실기기 검증을 실행할 수 있다. |
| NFR11 | U1 | u1-mobile-admin-onboarding | 동시 확인과 커밋 전후의 실패를 검증한다. |
| NFR12 | U1 | u1-mobile-admin-onboarding | 장애, 복원, 종료와 승인된 새 주기를 구분한다. |
| NFR13 | U1 | u1-mobile-admin-onboarding | 후보 권한을 온보딩 자체에 한정한다. |
| NFR14 | U1 | u1-mobile-admin-onboarding | Wi-Fi를 끈 안드로이드 Chrome에서 저장과 재조회를 확인한다. |

단위 안에서는 설치 자격, 로그인·후보 흐름, 원자적 확인·세션 복귀를 연결해 최소 통합 검증을 만든다. 이후 동일 경로의 경쟁·실패 및 기존 설치를 검증한다. 기능 요구사항 6건과 품질 요구사항 4건을 모두 U1에 배정했다.
