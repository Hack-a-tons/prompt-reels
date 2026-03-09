#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/.."

SERVER="reels.hurated.com"
PROJECT_DIR="prompt-reels"

show_help() {
    cat << 'EOF'
Usage: logs.sh [docker compose logs args...]

Examples:
  ./scripts/logs.sh --since 10m
  ./scripts/logs.sh -f
  ./scripts/logs.sh --tail 50
  ./scripts/logs.sh --help
EOF
}

# Parse options
ARGS=()
while [[ $# -gt 0 ]]; do
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

if [[ ${#ARGS[@]} -gt 0 ]]; then
    set -- "${ARGS[@]}"
else
    set --
fi

LOG_ARGS=""
if [[ $# -gt 0 ]]; then
    LOG_ARGS=$(printf '%q ' "$@")
fi

if [[ " $LOG_ARGS " != *" --timestamps "* ]] && [[ " $LOG_ARGS " != *" -t "* ]]; then
    LOG_ARGS="--timestamps $LOG_ARGS"
fi

ssh "$SERVER" "cd $PROJECT_DIR && docker compose logs $LOG_ARGS"
