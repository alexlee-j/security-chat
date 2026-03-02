#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000/api/v1}"
PASSWORD="${SMOKE_PASSWORD:-Password123}"
SUFFIX="$(date +%s)"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

need_cmd curl
need_cmd jq

register_user() {
  local username="$1"
  local email="$2"
  local phone="$3"

  curl -sS -X POST "${BASE_URL}/auth/register" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"${username}\",\"email\":\"${email}\",\"phone\":\"${phone}\",\"password\":\"${PASSWORD}\",\"deviceName\":\"smoke-${username}\",\"deviceType\":\"mac\",\"identityPublicKey\":\"pk-${username}\",\"signedPreKey\":\"spk-${username}\",\"signedPreKeySignature\":\"sig-${username}\"}"
}

extract_data() {
  local json="$1"
  local path="$2"
  echo "$json" | jq -r "$path"
}

alice_name="alice_${SUFFIX}"
bob_name="bob_${SUFFIX}"

alice_json="$(register_user "$alice_name" "${alice_name}@example.com" "+15550${SUFFIX: -6}")"
bob_json="$(register_user "$bob_name" "${bob_name}@example.com" "+16660${SUFFIX: -6}")"

alice_token="$(extract_data "$alice_json" '.data.accessToken')"
alice_id="$(extract_data "$alice_json" '.data.userId')"
bob_token="$(extract_data "$bob_json" '.data.accessToken')"
bob_id="$(extract_data "$bob_json" '.data.userId')"

if [[ -z "$alice_token" || -z "$bob_token" || "$alice_token" == "null" || "$bob_token" == "null" ]]; then
  echo "failed to register smoke users" >&2
  echo "alice=$alice_json" >&2
  echo "bob=$bob_json" >&2
  exit 1
fi

conversation_json="$(curl -sS -X POST "${BASE_URL}/conversation/direct" \
  -H "authorization: Bearer ${alice_token}" \
  -H 'content-type: application/json' \
  -d "{\"peerUserId\":\"${bob_id}\"}")"
conversation_id="$(extract_data "$conversation_json" '.data.conversationId')"

if [[ -z "$conversation_id" || "$conversation_id" == "null" ]]; then
  echo "failed to create direct conversation" >&2
  echo "$conversation_json" >&2
  exit 1
fi

media_file="$(mktemp /tmp/security-chat-media-smoke.XXXXXX.txt)"
echo "v1 smoke media file ${SUFFIX}" > "$media_file"

upload_json="$(curl -sS -X POST "${BASE_URL}/media/upload" \
  -H "authorization: Bearer ${alice_token}" \
  -F "file=@${media_file};type=text/plain" \
  -F "mediaKind=4")"
media_asset_id="$(extract_data "$upload_json" '.data.mediaAssetId')"

if [[ -z "$media_asset_id" || "$media_asset_id" == "null" ]]; then
  echo "failed to upload media" >&2
  echo "$upload_json" >&2
  exit 1
fi

attach_json="$(curl -sS -X POST "${BASE_URL}/media/${media_asset_id}/attach" \
  -H "authorization: Bearer ${alice_token}" \
  -H 'content-type: application/json' \
  -d "{\"conversationId\":\"${conversation_id}\"}")"

msg_nonce="nonce_${SUFFIX}"
msg_payload="eyJ0eXBlIjoiZmlsZSIsIm5hbWUiOiJzbW9rZS50eHQifQ=="

send_json="$(curl -sS -X POST "${BASE_URL}/message/send" \
  -H "authorization: Bearer ${alice_token}" \
  -H 'content-type: application/json' \
  -d "{\"conversationId\":\"${conversation_id}\",\"messageType\":4,\"encryptedPayload\":\"${msg_payload}\",\"nonce\":\"${msg_nonce}\",\"mediaAssetId\":\"${media_asset_id}\",\"isBurn\":false}")"

list_bob_json="$(curl -sS "${BASE_URL}/message/list?conversationId=${conversation_id}&afterIndex=0&limit=20" \
  -H "authorization: Bearer ${bob_token}")"

summary_bob_json="$(curl -sS "${BASE_URL}/notification/unread-summary" \
  -H "authorization: Bearer ${bob_token}")"

meta_json="$(curl -sS "${BASE_URL}/media/${media_asset_id}/meta" \
  -H "authorization: Bearer ${bob_token}")"

download_size="$(curl -sS "${BASE_URL}/media/${media_asset_id}/download" \
  -H "authorization: Bearer ${bob_token}" | wc -c | tr -d ' ')"

echo "=== V1 backend smoke summary ==="
echo "base_url=${BASE_URL}"
echo "alice_id=${alice_id}"
echo "bob_id=${bob_id}"
echo "conversation_id=${conversation_id}"
echo "media_asset_id=${media_asset_id}"
echo "attach_ok=$(extract_data "$attach_json" '.data.attached')"
echo "message_id=$(extract_data "$send_json" '.data.messageId')"
echo "bob_message_count=$(echo "$list_bob_json" | jq -r '.data | length')"
echo "bob_total_unread=$(extract_data "$summary_bob_json" '.data.totalUnread')"
echo "media_sha256=$(extract_data "$meta_json" '.data.sha256')"
echo "download_bytes=${download_size}"

echo "done"
