# Asterisk bridge: GPT-Live (SIP over TLS, SDES-SRTP, Opus) <-> Nvoip trunk (SIP, G.711).
FROM alpine:3.24

RUN apk add --no-cache asterisk asterisk-opus asterisk-srtp gettext jq openssl tini

COPY templates/ /opt/recuidado/templates/
COPY entrypoint.sh /opt/recuidado/entrypoint.sh
# Voice prompts of the test phone menu (URA), synthesized here; the TTS tools are removed after.
COPY make-test-sounds.sh /opt/recuidado/make-test-sounds.sh
RUN apk add --no-cache --virtual .tts espeak-ng sox \
 && sh /opt/recuidado/make-test-sounds.sh \
 && apk del .tts
RUN chmod +x /opt/recuidado/entrypoint.sh

ENTRYPOINT ["/sbin/tini", "--", "/opt/recuidado/entrypoint.sh"]
