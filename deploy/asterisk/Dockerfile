# Asterisk bridge: GPT-Live (SIP over TLS, SDES-SRTP, Opus) <-> Nvoip trunk (SIP, G.711).
FROM alpine:3.24

RUN apk add --no-cache asterisk asterisk-opus asterisk-srtp curl gettext jq openssl tini

COPY templates/ /opt/recuidado/templates/
COPY entrypoint.sh /opt/recuidado/entrypoint.sh
# Voice prompts of the test phone menu (URA), synthesized here; the TTS tools are removed after.
COPY make-test-sounds.sh /opt/recuidado/make-test-sounds.sh
RUN apk add --no-cache --virtual .tts espeak-ng sox \
 && sh /opt/recuidado/make-test-sounds.sh \
 && apk del .tts
# Call recordings (MixMonitor, started by recuidado/voice through AMI) are posted to the API by this script.
COPY upload-recording.sh /opt/recuidado/upload-recording.sh
RUN chmod +x /opt/recuidado/entrypoint.sh /opt/recuidado/upload-recording.sh \
 && mkdir -p /var/spool/asterisk/recuidado && chown asterisk:asterisk /var/spool/asterisk/recuidado

ENTRYPOINT ["/sbin/tini", "--", "/opt/recuidado/entrypoint.sh"]
