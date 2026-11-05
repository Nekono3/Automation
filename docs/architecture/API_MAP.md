# API inventory

Generated from the actual FastAPI OpenAPI schema for this iteration. Authentication, object scopes and input/business checks are applied separately. Webhooks require verified provider/service credentials.

| Method | Path | Coarse permission |
|---|---|---|
| GET | `/` | Public or specialized authentication; see handler |
| POST | `/api/auth/accept-invitation` |  |
| POST | `/api/auth/login` |  |
| GET | `/api/auth/me` | Public or specialized authentication; see handler |
| GET | `/api/automations` | automations.manage |
| POST | `/api/automations` | automations.manage |
| POST | `/api/automations/upload-attachment` | automations.manage |
| GET | `/api/automations/{trigger_id}` | automations.manage |
| PATCH | `/api/automations/{trigger_id}` | automations.manage |
| DELETE | `/api/automations/{trigger_id}` | automations.manage |
| GET | `/api/bookings` | leads.read_all / leads.read_team / leads.read_own |
| POST | `/api/bookings` | bookings.manage |
| GET | `/api/bookings/{booking_id}` | leads.read_all / leads.read_team / leads.read_own |
| POST | `/api/bookings/{booking_id}/cancel` | bookings.manage |
| POST | `/api/bookings/{booking_id}/confirm` | bookings.manage |
| GET | `/api/company/directory` | directory.read |
| PATCH | `/api/company/documents/{document_id}` | student_documents.review |
| GET | `/api/company/documents/{document_id}/download` | student_documents.read_all / student_documents.read_assigned |
| POST | `/api/company/finance/categories` | finance.manage |
| GET | `/api/company/finance/report` | finance.read |
| GET | `/api/company/finance/students` | finance.read |
| GET | `/api/company/finance/transactions` | finance.read |
| POST | `/api/company/finance/transactions` | finance.manage |
| POST | `/api/company/finance/transactions/{transaction_id}/void` | finance.manage |
| GET | `/api/company/kpi/metrics` | kpi.read_all / kpi.read_team / kpi.read_own |
| POST | `/api/company/kpi/metrics` | kpi.evaluate |
| GET | `/api/company/kpi/results` | kpi.read_all / kpi.read_team / kpi.read_own |
| PUT | `/api/company/kpi/results` | kpi.evaluate / kpi.evaluate_sales |
| GET | `/api/company/leads` | leads.read_all / leads.read_team / leads.read_own |
| POST | `/api/company/leads` | leads.create |
| PUT | `/api/company/leads/{customer_id}` | leads.update_all / leads.update_team / leads.update_own |
| POST | `/api/company/leads/{customer_id}/enroll` | students.create |
| GET | `/api/company/managers` | leads.read_all / leads.read_team |
| GET | `/api/company/students/{student_id}` | students.read_all / students.read_assigned |
| POST | `/api/company/students/{student_id}/documents` | student_documents.upload |
| PUT | `/api/company/students/{student_id}/links` | students.update_all |
| GET | `/api/conversations` | communication.read_all / communication.read_team / communication.read_assigned |
| GET | `/api/conversations/global-ai` | ai.settings.manage |
| POST | `/api/conversations/global-ai` | ai.settings.manage |
| GET | `/api/conversations/{conversation_id}` | communication.read_all / communication.read_team / communication.read_assigned |
| PATCH | `/api/conversations/{conversation_id}` | communication.mode |
| GET | `/api/conversations/{conversation_id}/messages` | communication.read_all / communication.read_team / communication.read_assigned |
| POST | `/api/conversations/{conversation_id}/messages` | communication.send |
| PATCH | `/api/conversations/{conversation_id}/mode` | communication.mode |
| GET | `/api/customers` | leads.read_all / leads.read_team / leads.read_own |
| GET | `/api/customers/{customer_id}` | leads.read_all / leads.read_team / leads.read_own |
| PATCH | `/api/customers/{customer_id}` | leads.update_all / leads.update_team / leads.update_own |
| GET | `/api/dashboard/stats` | dashboard.read_all |
| GET | `/api/deals` | leads.read_all / leads.read_team / leads.read_own |
| POST | `/api/deals` | leads.create |
| PATCH | `/api/deals/checklists/{checklist_id}` | leads.update_all / leads.update_team / leads.update_own |
| GET | `/api/deals/{deal_id}` | leads.read_all / leads.read_team / leads.read_own |
| PATCH | `/api/deals/{deal_id}/stage` | leads.update_all / leads.update_team / leads.update_own |
| GET | `/api/enrolled-students` | students.read_all / students.read_assigned |
| POST | `/api/enrolled-students` | students.create |
| GET | `/api/enrolled-students/stats` | students.read_all |
| POST | `/api/enrolled-students/sync` | imports.manage |
| GET | `/api/enrolled-students/{student_id}` | students.read_all / students.read_assigned |
| PATCH | `/api/enrolled-students/{student_id}` | students.update_all / students.update_assigned |
| DELETE | `/api/enrolled-students/{student_id}` | students.archive |
| GET | `/api/health` |  |
| DELETE | `/api/kpi/records/{record_id}` | kpi.legacy_manage |
| POST | `/api/kpi/scores` | kpi.legacy_manage |
| GET | `/api/kpi/sellers` | kpi.legacy_manage |
| POST | `/api/kpi/sellers` | kpi.legacy_manage |
| DELETE | `/api/kpi/sellers/{seller_id}` | kpi.legacy_manage |
| POST | `/api/kpi/sync` | kpi.legacy_manage |
| GET | `/api/programs` | universities.read |
| POST | `/api/programs` | universities.create |
| POST | `/api/programs/rename-university` | universities.create |
| GET | `/api/programs/stats` | universities.read |
| POST | `/api/programs/sync` | imports.manage |
| GET | `/api/programs/universities` | universities.read |
| GET | `/api/programs/{program_id}` | universities.read |
| PATCH | `/api/programs/{program_id}` | universities.update |
| DELETE | `/api/programs/{program_id}` | universities.archive |
| GET | `/api/security/catalog` | roles.manage |
| POST | `/api/security/conversation-assignments` | communication.assign |
| POST | `/api/security/invitations` | roles.manage |
| POST | `/api/security/student-assignments` | students.assign_mentor |
| POST | `/api/security/teams` | roles.manage |
| POST | `/api/security/users/{user_id}/password-reset` | roles.manage |
| PUT | `/api/security/users/{user_id}/permissions` | roles.manage |
| PUT | `/api/security/users/{user_id}/role` | roles.manage |
| GET | `/api/services` | services.read |
| POST | `/api/services` | settings.manage |
| PATCH | `/api/services/{service_id}` | settings.manage |
| GET | `/api/students/{customer_id}/profile` | leads.read_all / leads.read_team / leads.read_own |
| PATCH | `/api/students/{customer_id}/profile` | leads.update_all / leads.update_team / leads.update_own |
| GET | `/api/webhooks/instagram` | Public or specialized authentication; see handler |
| POST | `/api/webhooks/instagram` | Public or specialized authentication; see handler |
| GET | `/api/webhooks/whatsapp` | Public or specialized authentication; see handler |
| POST | `/api/webhooks/whatsapp` | Public or specialized authentication; see handler |
| POST | `/api/webhooks/whatsapp-bridge` | Public or specialized authentication; see handler |
| GET | `/api/whatsapp/accounts` | communication.manage_accounts |
| POST | `/api/whatsapp/accounts` | communication.manage_accounts |
| PATCH | `/api/whatsapp/accounts/{account_id}` | communication.manage_accounts |
| DELETE | `/api/whatsapp/accounts/{account_id}` | communication.manage_accounts |
| POST | `/api/whatsapp/accounts/{account_id}/disconnect` | communication.manage_accounts |
| POST | `/api/whatsapp/accounts/{account_id}/restart` | communication.manage_accounts |
| GET | `/privacy` | Public or specialized authentication; see handler |
| GET | `/terms` | Public or specialized authentication; see handler |
| GET | `/webhooks/instagram` | Public or specialized authentication; see handler |
| POST | `/webhooks/instagram` | Public or specialized authentication; see handler |
| GET | `/webhooks/whatsapp` | Public or specialized authentication; see handler |
| POST | `/webhooks/whatsapp` | Public or specialized authentication; see handler |
| POST | `/webhooks/whatsapp-bridge` | Public or specialized authentication; see handler |

## Iteration 01.5 additions / compatible changes

- `GET /api/ready`: public readiness, 200/503, DB revision validation; existing health contract retained.
- `PUT /api/security/teams/{team_id}`: director-controlled membership replacement, validated employees, audit.
- `PUT /api/security/users/{user_id}/whatsapp-account`: explicit numeric account PK/null, no guessed production mapping, conflicting owner409, released assignments/audit.
- `POST /api/conversations/{conversation_id}/messages`: optional Idempotency-Key header (8–128 chars), replay saved result or409; existing response schema unchanged.
- `GET /api/enrolled-students/stats`: read_all/read_assigned; SQL scope applied to every aggregate; mentor sees assigned statistics only.
