---
layout: review
title: "모바일 최초 관리자 배포 검증 진행 기록"
source_path: "aidlc/spaces/default/intents/261125-mobile-admin-onboarding/operation/deployment-execution/deployment-log.md"
permalink: "/reviews/261125-mobile-admin-onboarding/deployment-execution/20261126-225743383635/01-deployment-log/"
---

# 모바일 최초 관리자 배포 검증 진행 기록

## 완료한 확인

- Raspberry Pi 5 ARM64에서 개발 후보의 빌드와 임시 상태 디렉터리를 사용하는 설치 준비 명령을 확인했다. 실제 Chromium에서 합성 Google/Firebase 인증, 취소·새로고침·재인증, 최초 등록, 저장·재조회를 실행한 마지막 개별 검증은 종료 코드 0이었다.
- [빌드·테스트 결과](../../construction/build-and-test/test-results.md)에 전체 회귀를 기록했다. 변경 후보는 PR #46, 커밋 `1200710`이다.

## 실기기 배포 검증

- 사용자가 제공한 Firebase 설정을 읽어 별도 원본, DB, 포트, 백업 및 권위 저장소를 강제하는 테스트 환경을 구성했다. 격리 Caddy 실행 및 내부 헬스 경로 차단을 확인했다. 기존 HTTPS는 200을 반환했다.
- 운영자가 별도 권위 볼륨, 추가 Tailscale Serve 포트와 테스트용 OAuth 원본을 구성했다고 확인했다. Pi에서 마운트와 Serve 라우팅을 확인하고 새 격리 SQLite에 마이그레이션 및 최초 설정 허용 상태를 준비했다. 기동 전 가구 0건을 확인했다.
- 격리 앱과 프록시를 시작했다. 프록시가 직접 정적 번들을 제공하도록 조정한 뒤 HTTPS HTML과 JavaScript는 200, Google 클라이언트 설정은 200, 로그인 챌린지는 201, 내부 헬스 경로는 404를 반환했다. 기존 서비스의 HTTPS 응답도 200이었다.
- 운영자가 Android Chrome에서 목록 재조회까지 성공했다고 확인했다. 테스트 서버에서 Google 로그인 이후 설정 확인과 저장의 201 응답, 목록 조회 200을 확인했다. [실기기 결과](./smoke-test-results.md)와 [서비스 상태](./health-check-report.md)를 기록했다.
- 기존 SQLite·계정·서비스 설정 파일은 변경하지 않았다. 운영 서비스의 새 버전 전환은 실행 범위에 포함되지 않았다.
