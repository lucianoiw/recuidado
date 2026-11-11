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
say ura-answer "Temos sim. Custa trinta e dois reais e cinquenta centavos a caixa com trinta comprimidos. Esse não sai pelo Farmácia Popular."
say ura-bye "Por nada, tchau."
say hold-message "Todos os nossos atendentes estão ocupados. Por favor, aguarde na linha. Sua ligação é muito importante para nós."
say person-wait "Farmácia Teste, boa tarde. Só um minutinho, por favor, já te atendo."
say person-back "Pronto, desculpa a demora."
say closed "Olá, você ligou para a Farmácia Teste. Nosso horário de atendimento é de segunda a sábado, das oito às vinte e duas horas. Ligue novamente nesse horário. Obrigado."
# Hold music: 8 seconds of a simple chord, quiet, like a phone queue.
sox -n -r 8000 -c 1 -b 16 "$OUT/hold-music.wav" synth 8 sine 440 tremolo 2 40 vol 0.25
rm -f /tmp/say.wav
