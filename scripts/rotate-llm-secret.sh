#!/usr/bin/env bash
set -euo pipefail

# scripts/rotate-llm-secret.sh
# Small helper to set / rotate / remove / verify a repository secret (default: LLM_API_KEY)
# Usage:
#   ./scripts/rotate-llm-secret.sh --prompt
#   ./scripts/rotate-llm-secret.sh --file ./new_key.txt --verify
#   ./scripts/rotate-llm-secret.sh --prompt --trigger-pr test/obs-harden

REPO="${GITHUB_REPOSITORY:-ShoheiFukushima/AutoEditTATE}"
SECRET_NAME="LLM_API_KEY"
ACTION=""
VALUE_FILE=""
PROMPT=""
TRIGGER_BRANCH=""

usage() {
  cat <<'USAGE'
Usage: rotate-llm-secret.sh [options]
Options:
  --repo OWNER/REPO      GitHub repository (default: $GITHUB_REPOSITORY or ShoheiFukushima/AutoEditTATE)
  --name SECRET_NAME     Secret name to set (default: LLM_API_KEY)
  --file <path>          Read secret value from file
  --prompt               Prompt interactively (silent)
  --remove               Remove the secret
  --list                 List secrets in repo
  --verify               Verify secret presence after set (lists secrets)
  --trigger-pr <branch>  Create an empty commit on <branch> and push to trigger pull_request workflows
  --help                 Show this help
Examples:
  rotate-llm-secret.sh --prompt
  rotate-llm-secret.sh --file ./new_key.txt --verify
  rotate-llm-secret.sh --prompt --trigger-pr test/obs-harden
USAGE
}

check_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh CLI is required. Install from https://cli.github.com/" >&2
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo) REPO="$2"; shift 2;;
      --name) SECRET_NAME="$2"; shift 2;;
      --file) VALUE_FILE="$2"; ACTION="set"; shift 2;;
      --prompt) PROMPT="1"; ACTION="set"; shift;;
      --remove) ACTION="remove"; shift;;
      --list) ACTION="list"; shift;;
      --verify) ACTION="${ACTION:-verify}"; shift;;
      --trigger-pr) TRIGGER_BRANCH="$2"; shift 2;;
      --help|-h) usage; exit 0;;
      *) echo "Unknown arg: $1"; usage; exit 1;;
    esac
  done
}

main() {
  check_gh
  parse_args "$@"

  if [[ "$ACTION" == "" ]]; then
    echo "No action specified. Use --prompt or --file to set secret, or --list/--remove/--verify." >&2
    usage
    exit 1
  fi

  if [[ "$ACTION" == "list" ]]; then
    echo "Listing secrets for $REPO..."
    gh secret list --repo "$REPO"
    exit 0
  fi

  if [[ "$ACTION" == "remove" ]]; then
    echo "Removing secret $SECRET_NAME from $REPO"
    gh secret remove "$SECRET_NAME" --repo "$REPO"
    echo "Removed (or attempted)."
    exit 0
  fi

  if [[ "$ACTION" == "verify" ]]; then
    echo "Verifying secret presence for $SECRET_NAME in $REPO..."
    if gh secret list --repo "$REPO" | grep -E "(^| )$SECRET_NAME( |$)"; then
      echo "Secret $SECRET_NAME present"
    else
      echo "Secret $SECRET_NAME not found"
    fi
    exit 0
  fi

  if [[ "$ACTION" == "set" ]]; then
    if [[ -n "$VALUE_FILE" ]]; then
      if [[ ! -f "$VALUE_FILE" ]]; then
        echo "Value file not found: $VALUE_FILE" >&2
        exit 1
      fi
      SECRET_VALUE=$(cat "$VALUE_FILE")
    elif [[ -n "$PROMPT" ]]; then
      read -s -p "Enter $SECRET_NAME: " SECRET_VALUE; echo
    else
      echo "No input method specified for set. --file or --prompt required." >&2
      exit 1
    fi

    # Set secret (gh will encrypt on server side)
    echo "Setting secret $SECRET_NAME for $REPO..."
    gh secret set "$SECRET_NAME" --repo "$REPO" --body "$SECRET_VALUE"
    # Unset from environment
    unset SECRET_VALUE
    echo "Secret set successfully."

    # Verify presence
    if gh secret list --repo "$REPO" | grep -E "(^| )$SECRET_NAME( |$)" >/dev/null 2>&1; then
      echo "Verified: $SECRET_NAME present in $REPO"
    else
      echo "Warning: $SECRET_NAME not found after set"
    fi
  fi

  # Optional: trigger PR branch to run workflows
  if [[ -n "$TRIGGER_BRANCH" ]]; then
    if ! git rev-parse --verify "origin/$TRIGGER_BRANCH" >/dev/null 2>&1 && ! git rev-parse --verify "$TRIGGER_BRANCH" >/dev/null 2>&1; then
      echo "Branch $TRIGGER_BRANCH not found locally or on origin. Aborting trigger." >&2
      exit 1
    fi
    echo "Creating empty commit on $TRIGGER_BRANCH and pushing to origin to trigger PR workflows..."
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git checkout "$TRIGGER_BRANCH"
    git commit --allow-empty -m "ci: trigger auto-pr-review (LLM secret rotation test)" || true
    git push origin "$TRIGGER_BRANCH"
    git checkout "$CURRENT_BRANCH"
    echo "Push complete. You can inspect workflow runs with: gh run list --repo $REPO --branch $TRIGGER_BRANCH --limit 10"
  fi

  echo "Done."
}

main "$@"