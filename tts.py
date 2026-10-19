# Hindi voice-over for the video engine.
# Usage: echo '["line 1", "", "line 3"]' | TTS_ENGINE=edge python3 tts.py out/<id>/voice
# Writes scene-<n>.wav for every non-empty line (n = scene index). Engines:
#   edge  : Microsoft Edge neural voice (pip install edge-tts), voice from TTS_VOICE (default hi-IN-SwaraNeural)
#   piper : offline Piper voice (pip install piper-tts), model hi_IN-pratham-medium downloaded on first use
import asyncio, json, os, re, subprocess, sys, urllib.request

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
lines = json.load(sys.stdin)
engine = os.environ.get('TTS_ENGINE', 'edge')


def to_wav(src, dst):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ar', '44100', '-ac', '1', dst], check=True)


async def say(edge_tts, text, voice, rate, mp3, tag):
    # The service sometimes drops a request ("No audio was received"); retry before giving up.
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(mp3)
            return
        except Exception as e:
            print(f'tts line {tag} attempt {attempt + 1} failed: {e!r} ({text[:80]})', file=sys.stderr)
            if attempt == 3:
                raise
            await asyncio.sleep(3 * (attempt + 1))


async def edge():
    import edge_tts
    voice = os.environ.get('TTS_VOICE', 'hi-IN-SwaraNeural')
    rate = os.environ.get('TTS_RATE', '+10%')
    for i, text in enumerate(lines):
        if not text:
            continue
        mp3 = os.path.join(out, f'scene-{i}.mp3')
        # Long lines (long-form videos) go sentence by sentence and are joined: shorter requests fail less often,
        # and a sentence the service refuses ("No audio was received") is retried in comma-separated pieces.
        parts = [p.strip() for p in re.split(r'(?<=[।?.!])\s+', text) if p.strip()] if len(text) > 120 else [text]
        if len(parts) == 1:
            try:
                await say(edge_tts, text, voice, rate, mp3, i)
            except Exception:
                parts = [p.strip() for p in re.split(r'(?<=,)\s+', text) if p.strip()]
        if len(parts) > 1:
            files = []
            for k, part in enumerate(parts):
                f = os.path.join(out, f'scene-{i}-{k}.mp3')
                try:
                    await say(edge_tts, part, voice, rate, f, f'{i}.{k}')
                    files.append(f)
                except Exception:
                    pieces = [p.strip() for p in re.split(r'(?<=,)\s+', part) if p.strip()]
                    for m, piece in enumerate(pieces):
                        g = os.path.join(out, f'scene-{i}-{k}-{m}.mp3')
                        try:
                            await say(edge_tts, piece, voice, rate, g, f'{i}.{k}.{m}')
                            files.append(g)
                        except Exception:
                            # Last resort: leave this phrase silent (on screen it is still shown) rather than lose the video.
                            print(f'::warning::voice skipped a phrase in line {i}: {piece}')
            lst = os.path.join(out, f'scene-{i}.txt')
            with open(lst, 'w') as fh:
                fh.write(''.join(f"file '{f}'\n" for f in files))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, mp3], check=True)
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
