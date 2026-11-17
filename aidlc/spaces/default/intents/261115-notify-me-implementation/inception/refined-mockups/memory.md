<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-11-17T22:22:57Z — 기존 와이어프레임의 320 CSS px 표기는 최소 지원 폭이 아니라 당시 레이아웃 예시로 해석했다. 이후 승인된 NFR6.1과 NFR-UX-001이 고정 최소 너비를 금지하므로, 화면 전환은 콘텐츠 적합성에 따라 정의하고 모든 테스트 폭은 표본으로만 취급한다.
- 2026-11-17T22:34:46Z — WCAG 2.1 AA Reflow 기준에는 320 CSS px 상당 viewport 검사가 포함되지만, 이는 제품의 최소 물리 화면 폭을 선언하는 뜻이 아니다. 목업과 접근성 체크리스트에서 적합성 검사 조건, CSS px와 물리 pixel/PPI의 구분을 명시했다.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
