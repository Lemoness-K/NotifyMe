---
layout: review
title: "U3 단위 테스트 안내"
source_path: "aidlc/spaces/default/intents/261115-notify-me-implementation/construction/u3-reminder-workflows/code-generation/unit-test-instructions.md"
permalink: "/reviews/261115-notify-me-implementation/code-generation-u3-plan/20261122-123246277095/02-unit-test-instructions/"
---

# U3 단위 테스트 안내

## 실행

Node.js 24, 기존 npm 잠금 파일, SQLite native 어댑터 및 Chromium을 사용한다. 첫 Red 전에 runner가 U3 디렉터리를 수집하는지 확인한다. 준비가 끝나면 다음 명령을 사용한다.

```bash
npm exec -- vitest run tests/u3/
npm exec -- playwright test tests/e2e/u3/
```

Red/Green 기록은 대상 파일 단위로 좁힐 수 있다. 예를 들어 `npm exec -- vitest run tests/u3/storage-model.test.ts`를 사용한다. 브라우저 검증 전에 앱 빌드와 환경에 맞는 Chromium 준비를 마친다.

## 테스트 범위

| 대상 | 핵심 사례 |
| --- | --- |
| 모델·저장소·원장 | 마이그레이션 전후 데이터, 접근 회수, 멱등 결과와 다른 본문 차단, 안정 커서, 저널 기록 전후 장애·디스크 오류, 기준점 미발행, 닫힌 구간의 기존 작업 종결과 핸들 해제, 신규 원장 초기화와 기존 원장 유실 구분, 만료된 핸들의 늦은 발행 차단 |
| 회차와 검증 | 월말·DST·시간대, 건너뛰기, 여러 PENDING/검증 대기, 무담당·재지정, D-094~D-096, 기존 검증에 대한 경쟁 쓰기, 감사 보존 |
| API와 화면 | 실제 U1/U2 세션·가구·소속, 독립 대기 건수와 동작, 정렬 및 커서 오용, 업무 조회·편집·검증·보관 및 삭제, ko/en·화면 재배치·접근성 |

주요 컴포넌트별 단위·통합·종단 합계 10~15건 목표를 적용한다. 전체 프로젝트의 라인 커버리지 80%는 전체 회귀에서 별도로 측정한다.

## 시험 자원

합성 신원, 통제 가능한 시계, 매 실행 격리된 DB와 독립 원장을 사용한다. U2 데이터·설정·진짜 업무 배정을 DB에 만들고 실제 마이그레이션 및 트랜잭션을 사용한다. U4 설치 참여·U5 스냅샷 호출은 결정론적 대역으로 다룬다. ARM64에선 native 로드 이후 실제 커밋과 롤백을 확인한다. 디스크 및 프로세스 중단 사례에서는 요청당 기록 순번·커밋 증거·재시도 결과를 함께 검증한다.

## 현재 구현과 문서 이력 재검증

- U3 구현 커밋 `b21d350` 및 공통 [문서 변경 이력](../../code-generation/document-provenance.md)을 소스 매니페스트와 대조한다.
- U3 전용 Vitest·Playwright와 승인된 Construction 전체 검증으로 반복 회차, 완료 검증, 보관·삭제 및 회귀를 확인한다. 브라우저 확대 시 확인한 조작과 결과를 별도로 기록한다. 확대를 실행하지 못했다면 CSS 뷰포트 검증 결과와 구분해 이유를 남긴다.
