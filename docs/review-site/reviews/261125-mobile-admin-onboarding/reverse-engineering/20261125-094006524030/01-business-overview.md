---
layout: review
title: "사업 개요"
source_path: "aidlc/spaces/default/codekb/toyproj_notify_me/business-overview.md"
permalink: "/reviews/261125-mobile-admin-onboarding/reverse-engineering/20261125-094006524030/01-business-overview/"
---

# 사업 개요

## 제품 목적

Notify Me는 가족·동거인·파트너가 부탁과 반복 할 일을 함께 기록하고, 적절한 시간 또는 장소에서 담당자에게 알려 주며, 완료 결과를 공유하는 가구용 리마인더 서비스다.

## 대상 사용자와 가치

- 가구 구성원은 자신 또는 다른 구성원에게 할 일을 등록하고 함께 관리한다.
- 요청자와 담당자를 구분하며, 한 리마인더에 복수 담당자를 둘 수 있다.
- 회차별 완료와 놓침·건너뜀 이력을 공유한다.

## 제품 범위와 운영 맥락

Raspberry Pi 한 대에서 하나의 가구를 운영한다. 브라우저와 Android 앱이 공유 Web UI를 사용한다. Android 앱의 로컬 알림과 위치 감지, 상용화와 iOS의 범위는 기존 설계와 결정 등록부에 기록되어 있다. 이번 집중 분석은 모바일 브라우저 진입과 최초 관리자 등록을 다룬다.

## 최초 등록과 초대

- `D-074` 최초 관리자 서버 등록에 따라 운영자는 Firebase로 검증된 Google 계정을 지정해 CLI로 가구와 첫 Admin을 만든다. 현재 모바일 운영 가이드의 토큰 입력 단계가 이 흐름을 연결한다.
- `D-023` 지정 계정 초대는 최초 설정 후 별도 경로다. 관리자가 발급한 초대를 해당 이메일의 Google 계정이 수락하면 구성원으로 가입한다.
- `F-HH-001` 초기 가구 설정, `PR-AC-058` 최초 관리자 등록 수용 기준, `Q-048` 최초 부트스트랩 결정과 `DS-003` 계정·가구 온보딩 추적 항목이 변경의 기준이다. 모바일 확인과 취소, 동시 후보, 의도적 초기화와 복구의 구분은 후속 설계에서 정한다.

제품 요구사항은 `docs/01-product-requirements.md`, 기존 모바일 Pi 가이드는 `docs/u1-local-run.md`에 있다.
