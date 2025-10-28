#!/usr/bin/env bash
# macOS Disk Space Cleanup Runner (safe-first, dry-run by default)
#
# This script orchestrates the common cleanup/diagnostic steps described in
# docs/macos-disk-space-guide.md. It prefers read-only checks and requires
# --execute for any action that changes the system.
#
# Usage:
#   scripts/macos-cleanup-runner.sh diagnose [--path DIR] [--limit N]
#   scripts/macos-cleanup-runner.sh docker-prune [--execute]
#   scripts/macos-cleanup-runner.sh brew-cleanup [--execute]
#   scripts/macos-cleanup-runner.sh node-caches [--execute]
#   scripts/macos-cleanup-runner.sh tm-thin [--execute]
#   scripts/macos-cleanup-runner.sh spotlight-reindex [--execute]
#
# Global flags:
#   --execute      Actually perform changes (default is dry-run)
#   --path DIR     Target directory for scans (default: $HOME)
#   --limit N      Number of results for list operations (default: 30)
#   -y|--yes       Auto-confirm where applicable
#   -h|--help      Show help
#
# Notes:
# - You should run this script from the repository root or ensure the
#   scripts/find-large-files.sh helper is available in PATH.
# - Commands requiring privileges (e.g., tmutil) may prompt for sudo.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is intended for macOS (Darwin). Aborting." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR"/.. && pwd)"
FINDER_SCRIPT="$REPO_ROOT/scripts/find-large-files.sh"

EXECUTE=false
YES=false
SCAN_PATH="$HOME"
LIMIT=30
SUBCOMMAND=""

print_help() {
  sed -n '1,80p' "$0"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

confirm() {
  if $YES; then return 0; fi
  read -r -p "$1 [y/N]: " ans
  case "$ans" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

run_or_echo() {
  if $EXECUTE; then
    echo "> Running: $*"
    eval "$@"
  else
    echo "[dry-run] $*"
  fi
}

subcmd_diagnose() {
  echo "== Diagnose: quick read-only checks =="
  echo "-- Disk usage (df -h) --"
  df -h | sed 's/^/  /'

  echo "-- Top large directories under $SCAN_PATH (du -xh | tail) --"
  du -xh "$SCAN_PATH" 2>/dev/null | sort -h | tail -n "$LIMIT" | sed 's/^/  /'

  if [[ -x "$FINDER_SCRIPT" ]]; then
    echo "-- Top $LIMIT large files in $SCAN_PATH (using find-large-files.sh) --"
    bash "$FINDER_SCRIPT" -d "$SCAN_PATH" -n "$LIMIT" | sed 's/^/  /'
  else
    echo "(helper not found: $FINDER_SCRIPT)"
  fi

  if need_cmd tmutil; then
    echo "-- Time Machine local snapshots --"
    tmutil listlocalsnapshots / | sed 's/^/  /' || true
  else
    echo "(tmutil not available)"
  fi

  if need_cmd docker; then
    echo "-- Docker disk usage --"
    docker system df || true
  else
    echo "(docker not available)"
  fi

  if need_cmd brew; then
    echo "-- Homebrew cache directory size --"
    CACHE_DIR=$(brew --cache 2>/dev/null || echo "$HOME/Library/Caches/Homebrew")
    if [[ -d "$CACHE_DIR" ]]; then
      du -sh "$CACHE_DIR" 2>/dev/null | sed 's/^/  /'
    else
      echo "  (brew cache dir not found)"
    fi
  else
    echo "(brew not available)"
  fi

  if need_cmd pnpm; then echo "-- pnpm store path --"; pnpm store path | sed 's/^/  /'; fi
  if need_cmd npm; then echo "-- npm cache dir --"; npm config get cache | sed 's/^/  /'; fi
  if need_cmd yarn; then echo "-- yarn cache dir --"; yarn cache dir 2>/dev/null | sed 's/^/  /' || true; fi
}

subcmd_docker_prune() {
  if ! need_cmd docker; then
    echo "docker not available. Skipping."; return 0
  fi
  echo "== Docker prune (unused images/containers/volumes/build cache) =="
  if ! $EXECUTE; then
    echo "This will run: docker system prune -af && docker volume prune -f && docker builder prune -af"
  fi
  if confirm "Proceed with Docker prune?"; then
    run_or_echo docker system prune -af
    run_or_echo docker volume prune -f
    run_or_echo docker builder prune -af
  else
    echo "Skipped Docker prune."
  fi
}

subcmd_brew_cleanup() {
  if ! need_cmd brew; then
    echo "Homebrew (brew) not available. Skipping."; return 0
  fi
  echo "== Homebrew cleanup (remove old versions and caches) =="
  if ! $EXECUTE; then
    echo "This will run: brew cleanup --prune=all && brew cleanup -s"
  fi
  if confirm "Proceed with Homebrew cleanup?"; then
    run_or_echo brew cleanup --prune=all
    run_or_echo brew cleanup -s
  else
    echo "Skipped Homebrew cleanup."
  fi
}

subcmd_node_caches() {
  echo "== Node package manager caches =="
  local any=false
  if need_cmd pnpm; then
    any=true
    if ! $EXECUTE; then echo "Will run: pnpm store prune"; fi
    if confirm "Prune pnpm store?"; then
      run_or_echo pnpm store prune
    fi
  fi
  if need_cmd npm; then
    any=true
    if ! $EXECUTE; then echo "Will run: npm cache clean --force"; fi
    if confirm "Clean npm cache?"; then
      run_or_echo npm cache clean --force
    fi
  fi
  if need_cmd yarn; then
    any=true
    if ! $EXECUTE; then echo "Will run: yarn cache clean"; fi
    if confirm "Clean yarn cache?"; then
      run_or_echo yarn cache clean
    fi
  fi
  if [[ "$any" == false ]]; then
    echo "No pnpm/npm/yarn detected. Skipping."
  fi
}

subcmd_tm_thin() {
  if ! need_cmd tmutil; then
    echo "tmutil not available. Skipping."; return 0
  fi
  echo "== Time Machine: thin local snapshots =="
  if ! $EXECUTE; then
    echo "This will run: sudo tmutil thinlocalsnapshots / 999999999 4"
  fi
  if confirm "Proceed to thin Time Machine local snapshots?"; then
    run_or_echo sudo tmutil thinlocalsnapshots / 999999999 4
  else
    echo "Skipped Time Machine thinning."
  fi
}

subcmd_spotlight_reindex() {
  if ! need_cmd mdutil; then
    echo "mdutil not available. Skipping."; return 0
  fi
  echo "== Spotlight reindex (can be CPU/disk intensive) =="
  if ! $EXECUTE; then
    echo "This will run: sudo mdutil -E /"
  fi
  if confirm "Proceed to rebuild Spotlight index?"; then
    run_or_echo sudo mdutil -E /
  else
    echo "Skipped Spotlight reindex."
  fi
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    diagnose|docker-prune|brew-cleanup|node-caches|tm-thin|spotlight-reindex)
      SUBCOMMAND="$1"; shift ;;
    --execute) EXECUTE=true; shift ;;
    --path) SCAN_PATH="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    -y|--yes) YES=true; shift ;;
    -h|--help) print_help; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; print_help; exit 1 ;;
  esac
done

if [[ -z "$SUBCOMMAND" ]]; then
  echo "No subcommand provided." >&2
  print_help
  exit 1
fi

case "$SUBCOMMAND" in
  diagnose) subcmd_diagnose ;;
  docker-prune) subcmd_docker_prune ;;
  brew-cleanup) subcmd_brew_cleanup ;;
  node-caches) subcmd_node_caches ;;
  tm-thin) subcmd_tm_thin ;;
  spotlight-reindex) subcmd_spotlight_reindex ;;
  *) echo "Unknown subcommand: $SUBCOMMAND" >&2; exit 1 ;;
esac
