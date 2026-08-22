# Running OmniOS locally

Two independent processes: the frontend (root of the repo) and the backend
(`server/`), plus a Postgres container the backend depends on.

## Prerequisites (one-time)

- [Bun](https://bun.sh) — package manager + runtime for both frontend and backend.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — runs Postgres.
  On Windows this needs the WSL2 backend (`wsl --install --no-distribution`
  from an elevated PowerShell, then reboot, if WSL2 isn't already enabled).
- `server/.env` — copy `server/.env.example` to `server/.env` and fill in real
  secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_ENCRYPTION_KEY`,
  `GITHUB_WEBHOOK_SECRET`). Generate random hex values with:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  `DATABASE_URL` in the example already matches `server/docker-compose.yml`
  (`omnios`/`omnios` on port 5433) — no change needed there for local dev.

Install dependencies once (and again after pulling changes that touch
`package.json`):
```
bun install              # from repo root, installs frontend deps
cd server && bun install # installs backend deps
```

## Start everything (day to day)

```
# 1. Postgres (Docker Desktop must already be running)
cd server
docker compose up -d

# 2. Backend — http://localhost:4001
bun run start:dev

# 3. Frontend — http://localhost:8080 (from repo root, separate terminal)
cd ..
bun run dev
```

Both `start:dev` and `dev` run in watch mode, so code edits hot-reload.

Check the backend is actually talking to the database:
```
curl http://localhost:4001/health
# {"status":"ok","db":"ok"}
```

## First-time database setup

Only needed once per fresh Postgres volume (e.g. right after `docker compose
up -d` for the first time):
```
cd server
bun run prisma generate       # generates the Prisma client
bun run prisma migrate deploy # applies all migrations
bun run prisma:seed           # resets to known-good seed data + 10 test users
```
`prisma:seed` prints the seeded accounts and their (shared, dev-only)
password to the console — don't paste that output into anything that gets
committed.

## Stopping

- Frontend / backend: `Ctrl+C` in their terminal.
- Postgres: `docker compose down` (from `server/`) stops the container but
  keeps the data volume; add `-v` to also wipe the volume.

## Troubleshooting

- **`bun: command not found`** — Bun's installer updates `PATH`, but an
  already-open shell won't see it until restarted.
- **Backend can't reach Postgres** — confirm the container is healthy:
  `docker ps --filter name=postgres` should show `(healthy)`. If Docker
  Desktop itself won't start, it usually means WSL2 isn't enabled yet (see
  Prerequisites).
- **CORS / login redirect issues** — `CORS_ORIGIN` and `APP_URL` in
  `server/.env` must match the frontend's actual origin
  (`http://localhost:8080` by default; Vite auto-picks a different port if
  8080 is taken, in which case update both).
