# Soft background music, generated from scratch (no copyright): a slow pad plus a light arpeggio
# over a four-chord loop. The key and tempo come from the video id, so videos don't all sound the same.
# Usage: python3 music.py <seconds> <seed-text> <out.wav>
import hashlib, math, struct, sys, wave

secs, seed, dst = float(sys.argv[1]), sys.argv[2], sys.argv[3]
h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
SR = 22050
root = 220 * 2 ** (((h % 7) - 3) / 12)            # key: A3 +/- 3 semitones
bar = 60 / (84 + h % 20) * 4                         # one chord per bar, 84-103 bpm
prog = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]  # I - V - vi - IV
if h & 1:
    prog = [prog[2], prog[3], prog[0], prog[1]]      # vi - IV - I - V

n = int(secs * SR)
buf = bytearray()
for i in range(n):
    t = i / SR
    chord = prog[int(t / bar) % 4]
    f = [root * 2 ** (s / 12) for s in chord]
    pad = sum(math.sin(2 * math.pi * x * t) + 0.3 * math.sin(4 * math.pi * x * t) for x in f) / 6
    step = bar / 8                                    # eighth-note arpeggio, one octave up
    k, tt = int(t / step), t % step
    note = f[[0, 1, 2, 1][k % 4]] * 2
    arp = math.sin(2 * math.pi * note * t) * math.exp(-tt * 9) * 0.5
    env = min(1, t / 1.5, (secs - t) / 1.5)          # fade in / out
    v = (0.55 * pad + arp) * 0.35 * max(env, 0)
    buf += struct.pack('<h', int(max(-1, min(1, v)) * 32767))

with wave.open(dst, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(buf))
