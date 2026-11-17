<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-11-17T03:53:12Z — The user requested atomicity review after the first artifact pass. Keep feature-area parents for navigation, but give independently implementable or verifiable behavior its own stable child/sibling ID; decompose compound NFRs into detailed `NFRx.y` entries while preserving all existing IDs and open-policy questions.
- 2026-11-17T03:01:01Z — Requirement lifecycle status describes the approval state of the source-backed product policy; the stage review is tracked separately. This keeps inherited approved decisions and the current artifact review from being conflated. The register will point to explicit acceptance criteria and the existing DS trace targets without inventing new FR/NFR IDs.

- 2026-11-17T01:56:54Z — 요구사항 provenance와 AI 제안 분리; 프로젝트는 정식 FR/NFR의 Type·Origin·Status와 출처·검증·추적 링크를 요구한다. 승인된 기준에서 필연적으로 도출되지 않은 AI의 제품 선택은 AFR 카탈로그에 Proposed로 두고, 이번 요구사항 추적성 및 구현 범위에는 사용자 승인 전 포함하지 않는다. 현재 승인된 locale 기본값 `ko-KR`은 유지하고 첫 실행 기기 locale 자동 선택은 AFR-001로 분리했다.
- 2026-11-17T02:09:46Z — AFR-001 사용자 승인 후 승격; 사용자가 제안을 승인해 D-093/Q-065로 기록하고 `FR7.2`·`NFR7`에 승격했다. 유효 저장 locale 우선, 저장값이 없으면 지원 기기 locale 선택, 미지원 시 `ko-KR` fallback으로 기준 문서를 정합화했다.
- 2026-11-17T00:09:45Z — 승인 게이트의 수정 요청을 반영해 열린 리뷰 지적 두 건을 요구사항에 반영했다. FR1.4는 현재 설치에서 로그아웃·세션 만료/취소 후 인증 접근 종료를 명시하고 token 취소·설치 정리 세부사항은 DS-003에 남겼다. FR7.2/NFR7은 저장된 유효한 사용자 locale을 기기 locale보다 우선하고, 선택이 없거나 미지원일 때 기기 locale과 `ko-KR` fallback을 적용하도록 명확히 했다.
- 2026-11-16T23:55:29Z — 다국어 요구사항을 기존 결정에 맞춰 구체화했다. 요구사항의 FR7.2에는 사용자별 언어 선택·동기화와 기본/대체 locale을 명시했고, NFR7에는 locale resource로 도메인 변경 없이 언어를 확장하는 기준을 명시했다. 기존 PR-AC-052와 NFR-I18N 기준을 구체화한 것이므로 새 질문이나 ID는 추가하지 않았다.
- 2026-11-16T23:48:40Z — NFR6는 특정 모바일 너비를 지원 경계로 정하지 않는 반응형 요구사항으로 수정했다. 360px는 CSS 픽셀 단위이며 대표 viewport 테스트 값으로만 사용하고, 마스터 설계·테스트 전략·DS-002 설명도 같은 의미로 맞췄다.
- 2026-11-16T23:04:50Z — Q-063·Q-064의 MVP 포함 여부는 확정하고 세부 정책은 후속 설계로 남겼다. 승인된 범위와 미결정 세부사항을 각각 D-091·D-092 및 PR-AC-069·PR-AC-070에 연결했다.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-11-16T23:04:50Z — upstream-coverage가 의도서와 범위 문서 참조 누락을 지적해 요구사항에 기준 입력 경로를 추가한 뒤 지정된 검토 요청을 다시 실행했다.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-11-16T23:04:50Z — 검증자 권한·대기 만료 및 운영 보고·장애 판정·전달 방식은 기존 결정이 아니므로 가정하지 않고 연결된 상세 설계에서 확정하도록 남겼다.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-11-16T23:04:50Z — 제품 리뷰는 `F-ACC-002` 로그아웃·세션 관리 요구사항이 빠졌다고 지적했다. 이 항목은 요구사항 승인 게이트에서 검토 대상으로 제시한다.
- 2026-11-16T23:04:50Z — 팀의 80% 전체 라인 커버리지 목표와 `docs/08-test-strategy.md`의 기준 문구는 구현 전 정합화가 필요하다.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
