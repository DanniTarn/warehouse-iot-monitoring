#!/usr/bin/env bash
# Deploys the production Docker stack on the VPS.
# Installed as /usr/local/sbin/warehouse-deploy and invoked by the GitHub
# Actions deploy job through a restricted SSH key. Run it as ubuntu.
set -euo pipefail

repo_dir=/home/ubuntu/workspace/warehouse-iot-monitoring
state_file=/home/ubuntu/workspace/.warehouse-deployed-sha
lock_file=/home/ubuntu/workspace/.warehouse-deploy.lock

exec 9>"$lock_file"
flock -w 900 9 || {
  echo "another deploy holds $lock_file" >&2
  exit 75
}

git -C "$repo_dir" fetch --quiet --prune origin main
target=$(git -C "$repo_dir" rev-parse origin/main)
previous=$(cat "$state_file" 2>/dev/null || true)

if [[ "${1:-}" == "--check" && "$target" == "$previous" ]]; then
  exit 0
fi

git -C "$repo_dir" reset --hard --quiet "$target"

cd "$repo_dir/deployments"
site_address=$(grep -E '^SITE_ADDRESS=' .env.prod | cut -d= -f2-)

compose() {
  sudo -n docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"
}

if [[ -z "$previous" ]] || ! git -C "$repo_dir" cat-file -e "$previous^{commit}" 2>/dev/null; then
  echo "no recorded deploy, treating every file as changed"
  changed=$(git -C "$repo_dir" ls-tree -r --name-only "$target")
else
  changed=$(git -C "$repo_dir" diff --name-only "$previous" "$target")
fi

echo "deploying ${target:0:7} over ${previous:0:7}"

needs_backend=false
needs_web=false
config_changed=false
grep -qE '^backend/' <<<"$changed" && needs_backend=true
grep -qE '^frontend/' <<<"$changed" && needs_web=true
grep -qE '^deployments/' <<<"$changed" && config_changed=true

if $needs_backend || $config_changed; then
  echo "applying migrations"
  compose up -d postgres
  for file in "$repo_dir"/backend/migrations/*.sql; do
    echo "  $(basename "$file")"
    compose exec -T postgres psql -v ON_ERROR_STOP=1 -U warehouse_app -d warehouse_db <"$file" >/dev/null
  done
fi

if $config_changed; then
  echo "rebuilding every service for the changed compose or proxy config"
  compose up -d --build
elif $needs_web || $needs_backend; then
  services=()
  $needs_web && services+=(web)
  $needs_backend && services+=(backend)
  echo "rebuilding ${services[*]}"
  compose up -d --build "${services[@]}"
else
  echo "no runtime files changed"
fi

echo "checking the stack"
healthy=false
for _ in {1..24}; do
  if compose exec -T backend wget -qO- http://127.0.0.1:3000/health 2>/dev/null | grep -q '"status":"ok"' &&
    curl -fsS --max-time 5 -o /dev/null "https://$site_address/"; then
    healthy=true
    break
  fi
  sleep 5
done

if ! $healthy; then
  echo "health check failed, containers left as they are" >&2
  exit 1
fi

echo "$target" >"$state_file"
echo "deployed ${target:0:7}"
