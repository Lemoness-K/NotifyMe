# AI-originated 요구사항 제안 카탈로그

- 문서 역할: 사용자에게 확인되지 않은 AI-originated 제품 요구사항 제안을 기록하고 처분 이력을 보존한다.
- ID 기준: `AFR-NNN`은 이 문서에서 전역 고유하게 부여하며, 삭제하거나 재사용하지 않는다.
- 상태: `Proposed`, `Approved`, `Rejected`, `Deferred`.

## 등록·승격 규칙

- 각 제안은 유형(`FR`/`NFR`), 출처(`User`/`Derived`/`AI`), 배경·근거, 제안 내용, 기대 효과, 관련 요구사항, 영향 기능, 상태, 사용자 결정 provenance를 기록한다.
- 명시적인 사용자 승인 전에는 `Proposed` 항목을 정식 FR/NFR, Requirements Analysis의 `traceability.json`, 구현 또는 후속 단계 범위에 포함하지 않는다.
- 승인을 받으면 정식 요구사항에 새 FR/NFR ID를 부여하고 AFR과 연결한다. 기존 ID는 재번호화하지 않는다. 영향받는 제품 기준 문서와 [전체 ID 추적표](./09-feature-design-coverage-and-backlog.md#7-전체-id-추적표-ds-001)도 함께 갱신한다.
- 거절·보류한 제안도 이력으로 남긴다. 보류는 기존 승인 기준을 바꾸지 않는다.

## AFR-001

- **Type:** FR
- **Origin:** AI
- **Status:** Approved
- **배경·근거:** 사용자는 MVP에서 한국어·영어 지원 및 언어 확장 가능성을 요청했지만 첫 실행 동작은 정하지 않았다. 제안 시점의 승인 기준은 저장된 선택이 없으면 `ko-KR`을 사용했다(`D-065`, `D-066`, `PR-AC-052`, [ADR-034](./decisions/ADR-034-mvp-language-support.md)); 이후 `D-093`에서 본 제안을 승인했다.
- **제안:** 유효한 저장 사용자 locale이 있으면 그것을 우선한다. 저장 선택이 없거나 지원되지 않으면 기기 locale이 MVP 지원 언어(`ko-KR`, `en-US`)인지 확인해 자동 선택하고, 기기 locale도 지원되지 않으면 `ko-KR`을 사용한다.
- **기대 효과:** 영어 환경의 신규 사용자가 설정 변경 없이 영어 UI를 볼 수 있다. 대신 현재 승인된 `ko-KR` 기본값과 첫 실행 동작이 달라진다.
- **관련 요구사항:** `PR-AC-052`, `NFR-I18N-001`, `NFR-I18N-002`; 이번 Requirements Analysis의 언어 동작 후보 `FR7.2`, `NFR7`.
- **영향 기능:** `F-SET-003` (사용자 locale 및 시간대 설정).
- **결정 provenance:** 사용자가 Requirements Analysis에서 `제안 승인`을 선택했다. 프로젝트 결정은 `D-093`, 질문 이력은 `Q-065`.
- **승격 링크:** Requirements Analysis의 정식 `FR7.2`, `NFR7`; 요구사항 원문·검증 기준과 각 downstream 링크는 해당 산출물에서 관리한다.
