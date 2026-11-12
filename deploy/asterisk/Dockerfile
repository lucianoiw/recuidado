# Asterisk bridge: GPT-Live (SIP over TLS, SDES-SRTP, Opus) <-> Nvoip trunk (SIP, G.711).
FROM alpine:3.24

RUN apk add --no-cache asterisk asterisk-opus asterisk-srtp curl gettext jq openssl tini

COPY templates/ /opt/recuidado/templates/
COPY entrypoint.sh /opt/recuidado/entrypoint.sh
# Voice prompts of the test phone menus (URA), made with Piper by sounds/make.sh.
COPY sounds/*.wav /opt/recuidado/sounds/
# Call recordings (MixMonitor, started by recuidado/voice through AMI) are posted to the API by this script.
COPY upload-recording.sh /opt/recuidado/upload-recording.sh
RUN chmod +x /opt/recuidado/entrypoint.sh /opt/recuidado/upload-recording.sh \
 && mkdir -p /var/spool/asterisk/recuidado && chown asterisk:asterisk /var/spool/asterisk/recuidado

ENTRYPOINT ["/sbin/tini", "--", "/opt/recuidado/entrypoint.sh"]
