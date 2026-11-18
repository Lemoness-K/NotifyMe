# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

- Before planning or changing this project, read `AGENT.md`. It is the detailed project-specific guide. Also read `docs/decision-register.md` and `docs/00-master-design.md`, then the relevant design documents.
- Resolve conflicts in this order: the user's latest explicit request; confirmed decisions and open questions in `docs/decision-register.md`; `docs/00-master-design.md`; approved ADRs; detailed design documents; implementation.
- Do not present an open question or assumption as a confirmed product decision. If a change would alter product scope or an unresolved policy, record the impact and ask the user at the appropriate approval gate.
- Keep project documents in Korean and preserve stable requirement and decision IDs. For design interviews, register each `Q-NNN` and its source before asking; group at most five independent questions at a time and leave unanswered items open.

- 각 AI-DLC 단계가 승인되면 승인된 단계의 산출물만 커밋해 저장소 기본 브랜치로 향하는 PR을 만들고, PR 링크를 사용자에게 제공한다. 아직 승인되지 않은 다음 단계 산출물은 해당 PR에 포함하지 않는다. (learned 2026-11-17) <!-- cid:261115-notify-me-implementation:user-stories:3271c705b26a58d65798d0f3b351555fcd9dc02cd970963f03dbcb2a4b420262 -->

- Notify Me 구현 작업에서는 승인된 AI-DLC 단계 산출물을 PR 없이 origin의 기본 브랜치에 직접 반영한다. 원격 이력을 먼저 확인하고 보존하며, 푸시에는 확인한 원격 커밋을 지정한 force-with-lease를 사용한다. 이 작업에는 이전 단계별 PR 관행 대신 이 지침을 적용한다. (learned 2026-11-18) <!-- cid:261115-notify-me-implementation:units-generation:e4205084826bf339c0fa4b388a0221681d87c6fd7ac1d26cc516a5ddbe97a249 -->

## Requirements Provenance

- Record every formal FR/NFR with independent type (`FR`/`NFR`), origin (`User`/`Derived`/`AI`), lifecycle status (`Proposed`/`Approved`/`Rejected`/`Deferred`), source or derivation, acceptance/verification reference, and downstream traceability. `Derived` requires an approved source and an explanation of logical necessity. Keep these lifecycle statuses distinct from traceability coverage statuses.
- Keep optional AI-originated product suggestions in the project-wide `docs/requirement-proposals.md` catalog as `AFR-NNN` entries. Include background/evidence, expected effect, related requirements, affected features, status, decision provenance, and any promotion link. Until the user explicitly approves a proposal, exclude it from formal FR/NFR, the requirements `traceability.json`, and downstream implementation scope.
- On explicit approval, promote an AFR to a new formal FR/NFR ID without reusing or renumbering existing IDs, preserve the AFR link, and update affected source documents and the canonical ID trace table. Rejected or deferred proposals remain in the catalog as history and do not become formal requirements.

## Walking Skeleton

- The product is a shared household reminder app: members create requests and reminders, receive time- or location-based notifications, and share completion history.
- The first release must run reliably at low cost on Raspberry Pi while keeping boundaries clear enough for possible commercialization. Use the master design and approved decisions for the current implementation scope.

## Testing Posture

- Follow `docs/08-test-strategy.md` and the verification rules in `AGENT.md`. Use synthetic data and local test resources; never connect tests to production data or credentials.

## Guard Policy

<!-- Project-specific. Mode: strict, relaxed, or off. Strict here holds for every intent, whatever one person asks in chat; relaxed or off here applies to every intent whose policy came from its scope, unless the person sets another; changing this line changes it. A section under the retired Change Control heading, written by an earlier release, is still read. -->

## Deployment

- Treat Raspberry Pi ARM64, home-network reliability, storage life, and recovery from power loss as operating constraints.
- Do not add paid cloud services, expose the operating Raspberry Pi to the public internet, open ports, or use real personal data in tests without the user's approval. Assess cost, security, privacy, and operations when a proposal adds an external service or collects personal data.

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

- Check `docs/03-system-architecture.md` and the decision register before selecting or changing technologies. Keep domain behavior independent from UI frameworks, notification providers, and database implementations.

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

None (affirmed 2026-11-16)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

None (affirmed 2026-11-16)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- 문서 ID를 언급할 때는 ID 바로 옆에 해당 항목의 짧은 요약을 함께 쓴다. (learned 2026-11-16) <!-- cid:261115-notify-me-implementation:approval-handoff:fe57ad533f2dfe2ade245ec55f8d40da25ca14f2c9c81240319fb163b63a60e6 -->
- Requirements Analysis에서는 FR/NFR의 상위 ID를 탐색용 그룹으로 두고, 독립적으로 구현하거나 합격 여부를 판단할 수 있는 동작은 안정된 하위 ID로 분리한다. 서로 밀접한 규칙은 함께 묶을 수 있지만, 별도 추적이 필요한 세부 동작과 검증 기준은 각각 명시한다. (learned 2026-11-17) <!-- cid:261115-notify-me-implementation:requirements-analysis:874db7fce62cc4d1718da048952ea1e13a95cf69864bea27857a17e227df3fd8 -->
