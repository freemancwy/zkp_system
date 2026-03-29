#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUN_ID="${RUN_ID:-$(date +%s)}"
MAIN_PHONE="${MAIN_PHONE:-1390000${RUN_ID: -4}}"
SECOND_PHONE="${SECOND_PHONE:-1380000${RUN_ID: -4}}"
ACTIVITY="${ACTIVITY:-vote-${RUN_ID}}"
UNPUBLISHED_ACTIVITY="${UNPUBLISHED_ACTIVITY:-vote-unpublished-${RUN_ID}}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

print_step() {
  echo
  echo "== $1 =="
}

api_post() {
  local path="$1"
  local body="$2"
  curl -sS -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

api_get() {
  local path="$1"
  curl -sS "${BASE_URL}${path}"
}

assert_json_value() {
  local json="$1"
  local jq_expr="$2"
  local expected="$3"
  local actual
  actual="$(echo "$json" | jq -r "$jq_expr")"

  if [[ "$actual" != "$expected" ]]; then
    echo "Assertion failed for ${jq_expr}: expected '${expected}', got '${actual}'" >&2
    echo "$json" | jq
    exit 1
  fi
}

assert_json_number() {
  local json="$1"
  local jq_expr="$2"
  local expected="$3"
  local actual
  actual="$(echo "$json" | jq -r "$jq_expr")"

  if [[ "$actual" -ne "$expected" ]]; then
    echo "Assertion failed for ${jq_expr}: expected ${expected}, got ${actual}" >&2
    echo "$json" | jq
    exit 1
  fi
}

assert_json_not_null() {
  local json="$1"
  local jq_expr="$2"
  local actual
  actual="$(echo "$json" | jq -r "$jq_expr")"

  if [[ "$actual" == "null" || -z "$actual" ]]; then
    echo "Assertion failed for ${jq_expr}: expected a non-empty value" >&2
    echo "$json" | jq
    exit 1
  fi
}

build_vote_body() {
  local identity_nullifier="$1"
  local identity_trapdoor="$2"
  local proof_json="$3"
  local external_nullifier="$4"
  local vote_value="$5"

  jq -n \
    --arg identityNullifier "$identity_nullifier" \
    --arg identityTrapdoor "$identity_trapdoor" \
    --arg root "$(echo "$proof_json" | jq -r '.root')" \
    --arg externalNullifier "$external_nullifier" \
    --arg vote "$vote_value" \
    --argjson treePathElements "$(echo "$proof_json" | jq '.pathElements')" \
    --argjson treePathIndices "$(echo "$proof_json" | jq '.pathIndices')" \
    '{
      identityNullifier: $identityNullifier,
      identityTrapdoor: $identityTrapdoor,
      treePathElements: $treePathElements,
      treePathIndices: $treePathIndices,
      root: $root,
      externalNullifier: $externalNullifier,
      vote: $vote
    }'
}

print_step "1. Publish activity"
PUBLISH_RES="$(api_post "/api/external-nullifier/publish" "$(jq -n --arg externalNullifier "$ACTIVITY" '{externalNullifier: $externalNullifier}')")"
echo "$PUBLISH_RES" | jq
assert_json_value "$PUBLISH_RES" '.success' 'true'
assert_json_value "$PUBLISH_RES" '.externalNullifier' "$ACTIVITY"

print_step "2. Register main user"
REGISTER_MAIN="$(api_post "/api/register" "$(jq -n --arg phone "$MAIN_PHONE" '{phone: $phone}')")"
echo "$REGISTER_MAIN" | jq
assert_json_value "$REGISTER_MAIN" '.success' 'true'
assert_json_value "$REGISTER_MAIN" '.phone' "$MAIN_PHONE"

MAIN_IDENTITY_NULLIFIER="$(echo "$REGISTER_MAIN" | jq -r '.identityNullifier')"
MAIN_IDENTITY_TRAPDOOR="$(echo "$REGISTER_MAIN" | jq -r '.identityTrapdoor')"

print_step "3. Get proof for main user"
PROOF_MAIN="$(api_post "/api/merkle-proof" "$(jq -n --arg phone "$MAIN_PHONE" '{phone: $phone}')")"
echo "$PROOF_MAIN" | jq
assert_json_value "$PROOF_MAIN" '.success' 'true'
assert_json_value "$PROOF_MAIN" '.phone' "$MAIN_PHONE"
assert_json_number "$PROOF_MAIN" '.pathElements | length' 20
assert_json_number "$PROOF_MAIN" '.pathIndices | length' 20

print_step "4. Vote successfully"
VOTE_BODY="$(build_vote_body "$MAIN_IDENTITY_NULLIFIER" "$MAIN_IDENTITY_TRAPDOOR" "$PROOF_MAIN" "$ACTIVITY" "1")"
VOTE_MAIN="$(api_post "/api/vote" "$VOTE_BODY")"
echo "$VOTE_MAIN" | jq
assert_json_value "$VOTE_MAIN" '.success' 'true'
assert_json_value "$VOTE_MAIN" '.voteRecord.externalNullifier' "$ACTIVITY"
assert_json_value "$VOTE_MAIN" '.voteRecord.vote' '1'

print_step "5. Query activity stats"
STATS_MAIN="$(api_get "/api/activity-stats/${ACTIVITY}")"
echo "$STATS_MAIN" | jq
assert_json_value "$STATS_MAIN" '.success' 'true'
assert_json_number "$STATS_MAIN" '.totalVoters' 1
assert_json_number "$STATS_MAIN" '.voteCounts.support' 1
assert_json_number "$STATS_MAIN" '.voteCounts.against' 0

print_step "6. Negative case: duplicate registration"
DUP_REGISTER="$(api_post "/api/register" "$(jq -n --arg phone "$MAIN_PHONE" '{phone: $phone}')")"
echo "$DUP_REGISTER" | jq
assert_json_value "$DUP_REGISTER" '.success' 'false'
assert_json_value "$DUP_REGISTER" '.phone' "$MAIN_PHONE"

print_step "7. Negative case: invalid phone proof lookup"
INVALID_PHONE_PROOF="$(api_post "/api/merkle-proof" "$(jq -n --arg phone "abc" '{phone: $phone}')")"
echo "$INVALID_PHONE_PROOF" | jq
assert_json_value "$INVALID_PHONE_PROOF" '.success' 'false'

print_step "8. Negative case: vote on unpublished activity"
UNPUBLISHED_VOTE_BODY="$(build_vote_body "$MAIN_IDENTITY_NULLIFIER" "$MAIN_IDENTITY_TRAPDOOR" "$PROOF_MAIN" "$UNPUBLISHED_ACTIVITY" "1")"
UNPUBLISHED_VOTE="$(api_post "/api/vote" "$UNPUBLISHED_VOTE_BODY")"
echo "$UNPUBLISHED_VOTE" | jq
assert_json_value "$UNPUBLISHED_VOTE" '.success' 'false'
assert_json_not_null "$UNPUBLISHED_VOTE" '.error'

print_step "9. Negative case: duplicate vote on same activity"
DUP_VOTE="$(api_post "/api/vote" "$VOTE_BODY")"
echo "$DUP_VOTE" | jq
assert_json_value "$DUP_VOTE" '.success' 'false'
assert_json_not_null "$DUP_VOTE" '.error'
$STATS_AFTER_DUP="$(api_get "/api/activity-stats/${ACTIVITY}")"
echo "$STATS_AFTER_DUP" | jq
assert_json_number "$STATS_AFTER_DUP" '.totalVoters' 1

print_step "10. Negative case: stale path with updated root should fail after tree changes"
OLD_PROOF="$(api_post "/api/merkle-proof" "$(jq -n --arg phone "$MAIN_PHONE" '{phone: $phone}')")"
echo "$OLD_PROOF" | jq
assert_json_value "$OLD_PROOF" '.success' 'true'

REGISTER_SECOND="$(api_post "/api/register" "$(jq -n --arg phone "$SECOND_PHONE" '{phone: $phone}')")"
echo "$REGISTER_SECOND" | jq
assert_json_value "$REGISTER_SECOND" '.success' 'true'
assert_json_value "$REGISTER_SECOND" '.phone' "$SECOND_PHONE"

SECOND_ACTIVITY_PUBLISH="$(api_post "/api/external-nullifier/publish" "$(jq -n --arg externalNullifier "${ACTIVITY}-old-proof" '{externalNullifier: $externalNullifier}')")"
echo "$SECOND_ACTIVITY_PUBLISH" | jq
assert_json_value "$SECOND_ACTIVITY_PUBLISH" '.success' 'true'

CURRENT_ROOT="$(api_get "/api/root")"
echo "$CURRENT_ROOT" | jq
OLD_PROOF_WITH_NEW_ROOT="$(echo "$OLD_PROOF" | jq --arg root "$(echo "$CURRENT_ROOT" | jq -r '.root')" '.root = $root')"
OLD_PROOF_VOTE_BODY="$(build_vote_body "$MAIN_IDENTITY_NULLIFIER" "$MAIN_IDENTITY_TRAPDOOR" "$OLD_PROOF_WITH_NEW_ROOT" "${ACTIVITY}-old-proof" "0")"
OLD_PROOF_VOTE="$(api_post "/api/vote" "$OLD_PROOF_VOTE_BODY")"
echo "$OLD_PROOF_VOTE" | jq
assert_json_value "$OLD_PROOF_VOTE" '.success' 'false'
assert_json_not_null "$OLD_PROOF_VOTE" '.error'
$OLD_PROOF_STATS="$(api_get "/api/activity-stats/${ACTIVITY}-old-proof")"
echo "$OLD_PROOF_STATS" | jq
assert_json_number "$OLD_PROOF_STATS" '.totalVoters' 0

print_step "All tests passed"
echo "Main phone: $MAIN_PHONE"
echo "Second phone: $SECOND_PHONE"
echo "Activity: $ACTIVITY"
