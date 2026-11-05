# Permissions and scopes

The permission catalog and initial grants are in app/core/permissions.py; frozen migration grants are in migrations/initial_grants.json. Requests read grants from PostgreSQL, not from the role claim in a JWT. Direct per-user grants allow the director to explicitly permit additional capabilities, including salary access.

| Primary role | Default access |
|---|---|
| director | Full catalog, including roles, integrations, finance and salary capabilities |
| head_of_sales | Own/team leads, consultations, team communications and sales KPI; no finance/salaries/global AI settings |
| manager | Own assigned leads, deals, consultations and communications; university read; own KPI |
| mentor | Assigned students/documents/conversations and own KPI; no arbitrary student lookup |
| operations_director | Operational students, university catalog and employee KPI; mentor assignment; no finance/salaries or private student documents by default |
| finance_manager | Financial journal and billing names; salary capabilities reserved; no private document or WhatsApp administration access |

Every current API has an explicit coarse policy in authorization.py; unknown operations deny access. Policies use the actual request path, including mounted router prefixes. Object checks protect details, mutations, profile endpoints, document downloads, chat mode changes and sends. Lists use database scope predicates before pagination. Global-only aggregates are restricted until role-specific aggregates are implemented.

Team visibility uses explicit shared team memberships. Unbound managers see no implicit chats. Private documents require a document permission **and** a student assignment, except director's explicit all-document grant. Operational student access does not imply document access. Finance fields are projected out of non-financial student responses. Salary capabilities do not mean payroll functionality has already been built.

Head-of-sales access to students after contract, manager access to documents, handoff approval, ROP financial summaries and operations salary access remain least-privilege defaults pending corporate approval. Legacy seller KPI lacks a verified user/team link: its global archive is restricted to the director until a reviewed identity mapping exists; historical scores are unchanged.
