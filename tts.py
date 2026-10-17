# Hindi voice-over for the video engine.
# Usage: echo '["line 1", "", "line 3"]' | TTS_ENGINE=edge python3 tts.py out/<id>/voice
# Writes scene-<n>.wav for every non-empty line (n = scene index). Engines:
#   edge  : Microsoft Edge neural voice (pip install edge-tts), voice from TTS_VOICE (default hi-IN-SwaraNeural)
#   piper : offline Piper voice (pip install piper-tts), model hi_IN-pratham-medium downloaded on first use
import asyncio, json, os, subprocess, sys, urllib.request

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
lines = json.load(sys.stdin)
engine = os.environ.get('TTS_ENGINE', 'edge')


def to_wav(src, dst):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ar', '44100', '-ac', '1', dst], check=True)


async def edge():
    import edge_tts
    voice = os.environ.get('TTS_VOICE', 'hi-IN-SwaraNeural')
    rate = os.environ.get('TTS_RATE', '+10%')
    for i, text in enumerate(lines):
        if not text:
            continue
        mp3 = os.path.join(out, f'scene-{i}.mp3')
        await edge_tts.Communicate(text, voice, rate=rate).save(mp3)
        to_wav(mp3, os.path.join(out, f'scene-{i}.wav'))


def piper():
    name = os.environ.get('TTS_VOICE', 'hi_IN-pratham-medium')
    lang, spk, q = name.split('-')
    cache = os.path.expanduser('~/.cache/piper')
    os.makedirs(cache, exist_ok=True)
    model = os.path.join(cache, name + '.onnx')
    base = f'https://huggingface.co/rhasspy/piper-voices/resolve/main/{lang.split("_")[0]}/{lang}/{spk}/{q}/{name}.onnx'
    for ext in ('', '.json'):
        if not os.path.exists(model + ext):
            urllib.request.urlretrieve(base + ext, model + ext)
    for i, text in enumerate(lines):
        if not text:
            continue
        raw = os.path.join(out, f'scene-{i}.piper.wav')
        subprocess.run(['python3', '-m', 'piper', '-m', model, '-f', raw], input=text.encode(), check=True)
        to_wav(raw, os.path.join(out, f'scene-{i}.wav'))


if engine == 'edge':
    asyncio.run(edge())
elif engine == 'piper':
    piper()
else:
    sys.exit(f'unknown TTS_ENGINE {engine}')
