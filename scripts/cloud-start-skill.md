# Nehir Akademi cloud startup

Use `/workspace/nehirakademi`. Cloud tasks are already isolated: use this checkout; do not create a Git worktree unless explicitly requested. Read README.md and docs/VALIDATION.md. Preserve user files, source, tests and lockfiles during ordinary setup. Check Git status; do not reset or clean the checkout.

Use Node 24.19.0 (.nvmrc), or supported Node 22.9+. Retained npm dependencies and database files survive snapshots; running processes do not. If dependencies are absent, run the saved install script or `bash scripts/cloud-install.sh`. Run migrations only when no app process is using the same local PGlite database.

The app uses persistent local PostgreSQL via PGlite in `.local/database` when DATABASE_URL is absent. It supports one app process per local database directory. External PostgreSQL is selected by DATABASE_URL and remains unverified until a real connection is tested. Do not overwrite existing bindings or disable TLS verification. CLI database commands read `.env.local` when it exists.

Check configured binding names/readiness and variable presence without printing values. AI_API_KEY and access to api.openai.com are needed for live AI; do not invent credentials. The adapter preserves the inherited cloud HTTP/HTTPS proxy and CA trust. Live AI must be tested after the binding is supplied. Official MEB sources must be read before importing or verifying curriculum. The seeded workshops are independent exercises, not official curriculum; do not infer or fabricate program codes.

For local development, use existing private development account bindings when present. If a fresh local DB needs accounts, `npm run dev:accounts` creates randomly generated STUDENT/PARENT/ADMIN accounts and a parent-student link. It never overwrites existing passwords. Credentials stay in `.local/development-accounts.json` with mode 0600; never print or copy them into logs, chat, scripts or Git. External/production users are created via the documented user:create command and a securely supplied BOOTSTRAP_PASSWORD.

Start the development service from the checkout:

```bash
APP_URL=${APP_URL:-http://localhost:3000} npm run dev
```

Use an exec session or retained process handle; keep its output available for troubleshooting. Preserve a configured APP_URL. Do not start a second PGlite process against the same path. Reuse an already healthy service after checking its ownership. Stop only processes started for this task.

Readiness: request the local /login page and /api/auth/me. The login page should return HTTP 200; auth/me should return a user/null and aiReady boolean. An open port alone is insufficient. When functional verification is needed, authenticate with an authorized account without logging credentials, then fetch the student's dashboard and curriculum or run the existing test suite. Do not create user-facing localhost preview links.

Checks from the checkout: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Stop the development process before build/E2E because both use .next. `npm run test:e2e` builds and starts its own production server on 3001 with isolated `.local/e2e-database` and `.local/e2e-mail-outbox`; it must not replace the user's main DB or mail output. Chromium is installed at /usr/bin/chromium here; CHROMIUM_PATH can select another executable.

After checks, restart the development service if needed. Treat missing AI credentials, blocked MEB access, unconfigured real email delivery and untested external PostgreSQL as explicit limitations. Saved instructions and current-instance validation are not publication or proof of readiness in a new task.
