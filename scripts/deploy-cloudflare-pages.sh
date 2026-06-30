#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN
elif [[ ! -f "$HOME/.wrangler/config/default.toml" && ! -f "$HOME/.wrangler/config/default.json" && ! -f "$HOME/Library/Preferences/.wrangler/config/default.toml" && ! -f "$HOME/Library/Preferences/.wrangler/config/default.json" ]]; then
  echo "missing auth: 请先设置 CLOUDFLARE_API_TOKEN，或先执行 wrangler login"
  exit 1
fi

if [[ -z "${CLOUDFLARE_PAGES_PROJECT:-}" ]]; then
  if [[ $# -lt 1 ]]; then
    echo "missing project name"
    echo "请先设置 env: export CLOUDFLARE_PAGES_PROJECT=你的项目名"
    echo "或执行: CLOUDFLARE_PAGES_PROJECT=你的项目名 ./scripts/deploy-cloudflare-pages.sh"
    echo "or bash scripts/deploy-cloudflare-pages.sh 你的项目名"
    exit 1
  fi
fi

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-$1}"
BRANCH_NAME="${CLOUDFLARE_PAGES_BRANCH:-main}"

echo "开始构建并部署到 Cloudflare Pages: $PROJECT_NAME"

npm run build
npx wrangler pages deploy dist --project-name "$PROJECT_NAME" --branch "$BRANCH_NAME" --commit-dirty=true
echo "部署命令已执行。"
