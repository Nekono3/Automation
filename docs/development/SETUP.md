# Local setup

Use Python 3.11+, Node 22+, PostgreSQL, the existing backend virtualenv/dependencies and frontend package-lock.json. Do not copy production .env, sessions, student imports or private files into test environments.

1. Copy .env.example to an ignored .env and set local database credentials. Generate a distinct JWT key, bridge API token, bridge webhook token and verification token using `python -c "import secrets; print(secrets.token_urlsafe(48))"` for each value. Do not reuse a token between directions/services.
2. Start local PostgreSQL: `docker compose up -d postgres`.
3. From backend, install with `uv sync --extra dev` (or use the existing .venv), then run `.venv/bin/alembic upgrade head` for a **new empty** database. Existing databases require the baseline procedure.
4. Bootstrap the first director explicitly: `.venv/bin/python -m app.modules.security.bootstrap --email <director-email> --name <name>`. It only works on an empty users table. Privately deliver the printed single-use invitation; set its password through POST /api/auth/accept-invitation. No default password is created.
5. Start backend: `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`; frontend: `npm ci && npm run dev` from frontend.
6. Optional bridge: `npm ci` from whatsapp-bridge, configure its independent service secrets, CRM_WEBHOOK_URL, AUTH_DIR and loopback BRIDGE_HOST, then `npm start`. Use isolated session storage and dedicated test accounts in staging.

The existing frontend login works after invitation acceptance. Invitations, roles, grants, teams and assignments currently use authenticated security APIs; dedicated administration UI is a later iteration. Frontend landing/navigation follows returned permissions. No production deployment is implied by local setup.
