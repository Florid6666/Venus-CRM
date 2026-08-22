#!/bin/sh
# Starts the three processes that make up the container and ties their
# lifetimes together: if any one exits, the whole container exits so Railway
# restarts it rather than leaving a half-dead service serving errors.
set -eu

: "${PORT:=8080}"
: "${API_PORT:=4001}"
: "${WEB_PORT:=3000}"

if [ -z "${DATABASE_URL:-}" ]; then
	echo "FATAL: DATABASE_URL is not set. Attach a Postgres database in Railway" >&2
	echo "       and reference it, e.g. DATABASE_URL=\${{Postgres.DATABASE_URL}}" >&2
	exit 1
fi

# Nest reads these with getOrThrow, so a missing value crashes the API at boot
# with a stack trace rather than an actionable message. Fail loudly here instead.
for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
	eval "value=\${$var:-}"
	if [ -z "$value" ]; then
		echo "FATAL: $var is not set. Set it in the Railway service variables." >&2
		exit 1
	fi
done

# The API's CORS layer defaults to http://localhost:3000. Same-origin requests
# through Caddy carry no Origin header, so CORS is not exercised in normal use,
# but keep it coherent for anything calling the API cross-origin.
export CORS_ORIGIN="${CORS_ORIGIN:-${RAILWAY_PUBLIC_DOMAIN:+https://$RAILWAY_PUBLIC_DOMAIN}}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:$PORT}"

echo "==> Applying database migrations"
cd /app/server
# migrate deploy only replays committed migrations; it never prompts and never
# drops data, unlike `migrate dev`.
./node_modules/.bin/prisma migrate deploy

pids=""
terminating=""

terminate() {
	# Guard so the EXIT trap firing after a signal does not run this twice.
	[ -n "$terminating" ] && return
	terminating=1
	for pid in $pids; do
		kill -TERM "$pid" 2>/dev/null || true
	done
	wait 2>/dev/null || true
}

trap terminate TERM INT
trap terminate EXIT

echo "==> Starting NestJS API on 127.0.0.1:$API_PORT"
cd /app/server
PORT="$API_PORT" node dist/main.js &
pids="$pids $!"

echo "==> Starting TanStack Start SSR server on 127.0.0.1:$WEB_PORT"
cd /app/web
# Bind to loopback: only Caddy should reach this directly.
PORT="$WEB_PORT" HOST=127.0.0.1 node .output/server/index.mjs &
pids="$pids $!"

echo "==> Starting Caddy on :$PORT"
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
pids="$pids $!"

# Block until the first process exits, then tear the rest down. `wait -n`
# is not in POSIX sh, so poll instead.
while true; do
	for pid in $pids; do
		if ! kill -0 "$pid" 2>/dev/null; then
			echo "==> Process $pid exited; shutting down container" >&2
			exit 1
		fi
	done
	sleep 2
done
