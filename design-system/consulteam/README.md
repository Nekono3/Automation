# Consulteam UI refresh

The design is guided by UI/UX Pro Max, installed from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill into `~/.codex/skills/ui-ux-pro-max`. The skill is available for automatic discovery on the next turn; its instructions and generator were used directly during this change. `MASTER.md` records the generated guidance and the applied Consulteam decisions.

## Changed experience

- Branded login with password visibility, useful error feedback, and password-manager support.
- Labeled navy navigation, mobile menu, account controls, and keyboard skip link.
- Dashboard with current API metrics, admissions stages, upcoming consultations, recent conversations, and a team focus card.
- Responsive inbox with visible search, channel and view filters, working quick replies, delivery feedback, and an editable student profile dialog.
- Consistent headings, loading and retry states for students, consultations, pipelines, and automation.
- Student and consultation cards on small screens; contained scrolling for Kanban.
- Local Inter fonts and the supplied Consulteam logo.

## Validation

Chromium checks use isolated, synthetic API responses; no messages were sent to real students and no backend records were modified.

- Viewport checks: 375, 768, 1024 and 1440 px, across all six workspace routes.
- Inbox checks: mobile navigation, unread/channel/search filters, quick reply insertion, send and composer reset, profile dialog, Escape dismissal, back navigation, customer deep links, empty and API-failure states.
- Login checks: field labels, password visibility and mobile fit.
- Production build, TypeScript and ESLint for the changed UI files are checked before delivery. Repository-wide lint also includes pre-existing issues in API typing and the authentication context.

Run from `frontend` with `npm run dev`. The existing backend configuration and credentials are required for real data. The visual checks validate the frontend with fixtures; they do not validate live Instagram/WhatsApp delivery.

## Review previews

These images contain synthetic test data, not real student records.

- [Desktop overview](previews/overview-desktop.png)
- [Desktop login](previews/login-desktop.png)
- [Phone overview](previews/overview-mobile.png)
- [Phone conversation](previews/chat-mobile.png)

Final validation: production build and TypeScript passed; ESLint passed with no warnings for all changed UI files. All six workspace routes fit the four tested viewport widths. The rendered visible text contrast checks passed after adjusting secondary text colors. Reduced-motion preference was verified in Chromium. This is a focused frontend check, not a full WCAG conformance audit.
