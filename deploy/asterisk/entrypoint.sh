#!/bin/sh
# Renders the Asterisk config from environment variables and loads the TLS certificate.
set -eu

missing=""
for v in SIP_DOMAIN OPENAI_SIP_USERNAME OPENAI_SIP_PASSWORD NVOIP_SIP_USER NVOIP_SIP_PASSWORD CALL_ALLOWED_NUMBERS; do
  eval "val=\${$v:-}"
  [ -z "$val" ] && missing="$missing $v"
done
if [ -n "$missing" ]; then
  # Idle instead of crash-looping until the secrets are set in Coolify.
  echo "Asterisk bridge not configured, missing:$missing" >&2
  exec sleep infinity
fi
export NVOIP_SIP_HOST="${NVOIP_SIP_HOST:-app.nvoip.com.br}"
export SIP_TLS_PORT="${SIP_TLS_PORT:-5061}"
export NVOIP_LOCAL_PORT="${NVOIP_LOCAL_PORT:-5062}"
export RTP_START="${RTP_START:-10000}"
export RTP_END="${RTP_END:-10200}"
PUBLIC_IP="${PUBLIC_IP:-}"

# Allowed destinations as a regex of national numbers (DDD + number), e.g. ^(11912345678|11998765432)$
NUMS=$(echo "$CALL_ALLOWED_NUMBERS" | tr -d ' +()-' | tr ',' '\n' | sed -E 's/^55([0-9]{10,11})$/\1/' | paste -sd '|' -)
export ALLOWED_REGEX="^(${NUMS})\$"

KEYS=/etc/asterisk/keys
mkdir -p "$KEYS"

if [ -n "${ACME_JSON:-}" ] && [ -f "$ACME_JSON" ]; then
  # Reuse the Let's Encrypt certificate that Traefik (Coolify proxy) issued for SIP_DOMAIN.
  # Traefik stores them as {"<resolver>": {"Certificates": [{"domain": {"main", "sans"}, "certificate", "key"}]}}.
  FILTER='[.. | objects | (.Certificates? // .certificates? // empty) | .[]? | select(.domain.main == $d or ((.domain.sans // []) | index($d)))][0]'
  CERT=$(jq -r --arg d "$SIP_DOMAIN" "$FILTER.certificate // empty" "$ACME_JSON")
  KEY=$(jq -r --arg d "$SIP_DOMAIN" "$FILTER.key // empty" "$ACME_JSON")
  if [ -z "$CERT" ] || [ -z "$KEY" ]; then
    echo "No certificate for $SIP_DOMAIN in $ACME_JSON yet. Give the domain to an HTTP service in Coolify; retrying in 60s." >&2
    sleep 60
    exit 1
  fi
  echo "$CERT" | base64 -d > "$KEYS/sip.crt"
  echo "$KEY" | base64 -d > "$KEYS/sip.key"
elif [ -f "$KEYS/sip.crt" ] && [ -f "$KEYS/sip.key" ]; then
  echo "Using certificate already in $KEYS"
else
  echo "No ACME_JSON given, generating a self-signed certificate (local testing only)" >&2
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=$SIP_DOMAIN" \
    -keyout "$KEYS/sip.key" -out "$KEYS/sip.crt" 2>/dev/null
fi
chown asterisk:asterisk "$KEYS"/sip.*
chmod 600 "$KEYS/sip.key"

if [ -n "$PUBLIC_IP" ]; then
  export EXTERNAL_ADDR_LINES="external_media_address=$PUBLIC_IP
external_signaling_address=$PUBLIC_IP"
else
  export EXTERNAL_ADDR_LINES=""
fi

# AMI (manager.conf) only when a secret is set: recuidado/voice uses it to mute the AI toward a recorded menu.
if [ -n "${AMI_SECRET:-}" ]; then
  export AMI_ENABLED=yes
else
  export AMI_ENABLED=no AMI_SECRET=unused
fi

VARS='$AMI_ENABLED $AMI_SECRET $SIP_TLS_PORT $NVOIP_LOCAL_PORT $NVOIP_SIP_HOST $NVOIP_SIP_USER $NVOIP_SIP_PASSWORD $OPENAI_SIP_USERNAME $OPENAI_SIP_PASSWORD $RTP_START $RTP_END $ALLOWED_REGEX $EXTERNAL_ADDR_LINES'
for f in /opt/recuidado/templates/*.conf; do
  envsubst "$VARS" < "$f" > "/etc/asterisk/$(basename "$f")"
done

exec asterisk -f -U asterisk -G asterisk -vvv
