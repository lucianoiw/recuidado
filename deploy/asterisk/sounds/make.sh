#!/bin/sh
# Voice prompts of the test phone menus (URA) in extensions.conf. Run by hand when a line changes;
# the WAVs are committed and copied into the image. Neural TTS (Piper, offline, free) because the
# old espeak-ng voice was too robotic to understand on the phone. Asterisk plays 8 kHz 16-bit mono.
#   pip install piper-tts
#   VOICES=<dir with pt_BR-faber-medium.onnx and pt_BR-cadu-medium.onnx (+ .onnx.json)> sh make.sh
# Voices: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR
set -eu
OUT=$(cd "$(dirname "$0")" && pwd)
VOICES=${VOICES:?set VOICES to the folder with the Piper models}
TMP=$(mktemp -d)
# $1 voice (faber = recorded menus, cadu = the person who answers), $2 file name, $3 text.
say() {
  echo "$3" | python3 -m piper -m "$VOICES/pt_BR-$1-medium.onnx" -f "$TMP/say.wav"
  ffmpeg -loglevel error -y -i "$TMP/say.wav" -af "afade=t=in:d=0.02,apad=pad_dur=0.2" -ar 8000 -ac 1 -sample_fmt s16 "$OUT/$2.wav"
}
say faber ura-menu "Bem-vindo à Farmácia Teste. Para receitas e documentos, tecle 1. Para preço e estoque de remédios, tecle 2. Para outros assuntos, tecle 9."
say faber sim1-menu "Bem-vindo à Drogaria Vida. Para receitas, tecle 1. Para preço e estoque de remédios, tecle 2. Para falar com o financeiro, tecle 9."
say faber sim3-menu "Olá, você ligou para a Drogaria Bom Preço. Para entregas, tecle 1. Para trocas, tecle 2. Para falar com um atendente da farmácia, tecle 3."
say faber ura-wrong "Esta opção não informa preço de remédios. Voltando ao menu."
say cadu ura-attendant "Farmácia Teste, boa tarde."
say cadu ura-hello "Alô? Farmácia Teste."
say cadu ura-answer "Temos sim. Custa trinta e dois reais e cinquenta centavos a caixa com trinta comprimidos. Esse não sai pelo Farmácia Popular."
say cadu ura-bye "Por nada, tchau."
say faber hold-message "Todos os nossos atendentes estão ocupados. Por favor, aguarde na linha. Sua ligação é muito importante para nós."
say cadu person-wait "Farmácia Teste, boa tarde. Só um minutinho, por favor, já te atendo."
say cadu person-back "Pronto, desculpa a demora."
say faber closed "Olá, você ligou para a Farmácia Teste. Nosso horário de atendimento é de segunda a sábado, das oito às vinte e duas horas. Ligue novamente nesse horário. Obrigado."
# Hold music: 8 seconds of a simple tone, quiet, like a phone queue.
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=8" -af "tremolo=f=2:d=0.4,volume=0.25" -ar 8000 -ac 1 -sample_fmt s16 "$OUT/hold-music.wav"
rm -rf "$TMP"
# Plain RIFF header (fmt + data only), the simplest WAV for Asterisk.
python3 - "$OUT" <<'PY'
import glob, sys, wave
for f in glob.glob(sys.argv[1] + "/*.wav"):
    r = wave.open(f); p = r.getparams(); d = r.readframes(r.getnframes()); r.close()
    w = wave.open(f, "wb"); w.setparams(p); w.writeframes(d); w.close()
PY
