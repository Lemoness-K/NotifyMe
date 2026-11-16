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

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- 문서 ID를 언급할 때는 ID 바로 옆에 해당 항목의 짧은 요약을 함께 쓴다. (learned 2026-11-16) <!-- cid:261115-notify-me-implementation:approval-handoff:fe57ad533f2dfe2ade245ec55f8d40da25ca14f2c9c81240319fb163b63a60e6 -->
