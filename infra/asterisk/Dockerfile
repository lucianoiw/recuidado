# Asterisk bridge: GPT-Live (SIP over TLS, SDES-SRTP, Opus) <-> Nvoip trunk (SIP, G.711).
FROM alpine:3.24

RUN apk add --no-cache asterisk asterisk-opus asterisk-srtp gettext jq openssl tini

COPY templates/ /opt/recuidado/templates/
COPY entrypoint.sh /opt/recuidado/entrypoint.sh
RUN chmod +x /opt/recuidado/entrypoint.sh

ENTRYPOINT ["/sbin/tini", "--", "/opt/recuidado/entrypoint.sh"]
