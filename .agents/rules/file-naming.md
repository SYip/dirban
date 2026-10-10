---
trigger: model_decision
description: "Rules for organization by business domain, kebab-case directory/file naming, PascalCase components, test suffixes, and infra files."
---

# File & Directory Naming Conventions

## 1. Domain-Driven Organization (Business vs. Technical Domain)
- **Organize by Business Domain**: Group code, types, and logic around business features/concepts, never by technical artifact types.
  - Prohibited: Technical bucket directories like `/types/`, `/interfaces/`, or `/helpers/` grouping unrelated features.
  - Required: Feature/domain modules colocating logic, models, and types (e.g., `user-profile/types.ts`, `auth/session.ts`, `order-processing/validate.ts`).

## 2. Directories
- Use **kebab-case** for all directories without exception:
  - Feature & Domain Folders: `user-profile/`, `order-processing/`, `auth-session/`
  - Applications & Services: `apps/web-client/`, `apps/api-gateway/`
  - Shared Packages & Libraries: `packages/ui-components/`, `packages/analytics/`
  - Routes & Pages: `routes/dashboard-settings/`, `pages/checkout/`

## 3. Source Files

- **TypeScript / JavaScript Utilities & Logic**: Use **kebab-case** (e.g.,
  `format-date.ts`, `validate-email.ts`, `fetch-client.ts`).
- **UI Components**: Use **PascalCase** (e.g., `UserProfileCard.tsx`,
  `NavigationBar.tsx`, `ModalDialog.tsx`).
- **Unit Test Files**: Suffix matching source file in **kebab-case** with `.test.ts` (e.g.,
  `validate-email.test.ts`, `fetch-client.test.ts`).
