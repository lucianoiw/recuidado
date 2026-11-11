#!/bin/sh
# Synthetic voice prompts for the test phone menu (URA) in extensions.conf, made at build time
# so no audio file is committed. Asterisk plays 8 kHz, 16-bit mono WAV.
set -eu
OUT=/opt/recuidado/sounds
mkdir -p "$OUT"
say() {
  espeak-ng -v pt-br -s 145 -w /tmp/say.wav "$2"
  sox /tmp/say.wav -r 8000 -c 1 -b 16 "$OUT/$1.wav"
}
say ura-menu "Bem-vindo à Farmácia Teste. Para receitas e documentos, tecle 1. Para preço e estoque de remédios, tecle 2. Para outros assuntos, tecle 9."
say ura-wrong "Esta opção não informa preço de remédios. Voltando ao menu."
say ura-attendant "Farmácia Teste, boa tarde."
say ura-answer "Temos sim. Custa trinta e dois reais e cinquenta centavos a caixa com trinta comprimidos, e sai pelo Farmácia Popular."
say ura-bye "Por nada, tchau."
rm -f /tmp/say.wav
