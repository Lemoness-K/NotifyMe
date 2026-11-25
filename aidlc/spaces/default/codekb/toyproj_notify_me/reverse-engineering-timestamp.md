# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-25
- Commit: 63acbc1ebd82a58862fefd55f28f7005def0409d

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: mobile-admin-onboarding
fingerprint: 6fcd6353bf2d61c402ccff8d920d91fe16256dd1
analyzed:
  paths:
    - src/server/auth.ts
    - src/server/bootstrap-admin.ts
    - src/server/config.ts
    - src/server/provider.ts
    - src/server/storage.ts
    - src/server/main.ts
    - src/server/operations/activation.ts
    - src/server/operations/restore.ts
    - src/server/operations/runtime.ts
    - src/web/client.ts
    - prisma/migrations/202611180001_u1/migration.sql
    - tests/u1/auth-session.test.ts
    - tests/e2e/u1/core-flow.spec.ts
    - deploy/u1/Caddyfile.example
    - deploy/u5/README.md
    - docs/u1-local-run.md
    - package.json
  components:
    - 공유 Web UI
    - NestJS API 및 업무 모듈
    - Prisma 저장소 및 SQLite
    - Caddy ingress
    - 관리형 활성화와 복구
shallow:
  paths:
    - AGENT.md
    - docs/00-master-design.md
    - docs/01-product-requirements.md
    - docs/02-domain-and-data-design.md
    - docs/03-system-architecture.md
    - docs/04-notification-and-scheduling.md
    - docs/05-settings-and-feature-configuration.md
    - docs/06-deployment-and-operations.md
    - docs/07-security-and-privacy.md
    - docs/08-test-strategy.md
    - docs/09-feature-design-coverage-and-backlog.md
    - docs/decision-register.md
    - docs/designs/task-history-and-archive-screens.md
    - docs/interviews/2026-11-16-session-08.md
    - docs/decisions/ADR-022-react-router-vite-spa.md
    - docs/decisions/ADR-023-nestjs-api-framework.md
    - docs/decisions/ADR-024-prisma-orm-sqlite-access.md
    - docs/decisions/ADR-025-caddy-ddns-https-ingress.md
    - docs/decisions/ADR-036-account-and-household-closure.md
    - docs/decisions/ADR-038-systemd-rpi-service-management.md
    - docs/decisions/
    - docs/interviews/
    - src/server/http.ts
    - src/server/households.ts
    - src/server/operations-cli.ts
    - src/web/App.tsx
    - src/web/messages.ts
    - prisma/schema.prisma
    - tests/u1/http.test.ts
    - tests/u1/web-interactions.test.tsx
    - tests/u2/http.test.ts
    - tests/u2/repository.test.ts
    - tests/u5/backup.test.ts
    - tests/u5/runtime.test.ts
    - package-lock.json
```
