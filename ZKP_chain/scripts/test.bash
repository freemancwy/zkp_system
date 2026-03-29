#!/usr/bin/env bash

set -e

PHONE="13900000001"
ACTIVITY="vote-2026-003"

echo "1.发布活动"
curl -s -X POST http://localhost:3000/api/external-nullifier/publish \
  -H "Content-Type: application/json" \
  -d "{\"externalNullifier\":\"$ACTIVITY\"}" | jq

echo "2. 注册用户"
REGISTER=$(curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\"}")
echo "$REGISTER" | jq

IDENTITY_NULLIFIER=$(echo "$REGISTER" | jq -r '.identityNullifier')
IDENTITY_TRAPDOOR=$(echo "$REGISTER" | jq -r '.identityTrapdoor')

echo "3. 获取merkleProof"
PROOF=$(curl -s -X POST http://localhost:3000/api/merkle-proof \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\"}")
echo "$PROOF" | jq

ROOT=$(echo "$PROOF" | jq -r '.root')
PATH_ELEMENTS=$(echo "$PROOF" | jq '.pathElements')
PATH_INDICES=$(echo "$PROOF" | jq '.pathIndices')

echo "4. 投票"
VOTE_RESULT=$(curl -s -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d "{
    \"identityNullifier\":\"$IDENTITY_NULLIFIER\",
    \"identityTrapdoor\":\"$IDENTITY_TRAPDOOR\",
    \"treePathElements\":$PATH_ELEMENTS,
    \"treePathIndices\":$PATH_INDICES,
    \"root\":\"$ROOT\",
    \"externalNullifier\":\"$ACTIVITY\",
    \"vote\":\"1\"
  }")
echo "$VOTE_RESULT" | jq

echo "5. 状态"
curl -s http://localhost:3000/api/activity-stats/$ACTIVITY | jq
