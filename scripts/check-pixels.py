"""Checks crisp, even pixels in each viewport's shell screenshot (docs/screenshots/<viewport>/shell-world.png).

Every game pixel must be a solid scale x scale block of device pixels, and the canvas exactly 256*scale x
224*scale device pixels. The outermost ring of game pixels is reported apart: where the canvas meets the
bezel, the compositor may soften a single device pixel against it.
Usage: python3 scripts/check-pixels.py docs/screenshots
"""
import json
import os
import sys

import numpy as np
from PIL import Image

root = sys.argv[1]
ok = True
for vp in sorted(os.listdir(root)):
    d = os.path.join(root, vp)
    if not os.path.isdir(d):
        continue
    m = json.load(open(os.path.join(d, 'canvas.json')))
    a = np.asarray(Image.open(os.path.join(d, 'shell-world.png')).convert('RGB')).astype(np.int32)
    a = a[..., 0] * 65536 + a[..., 1] * 256 + a[..., 2]
    k, dpr = m['scale'], m['dpr']
    bx, by = round(m['left'] * dpr), round(m['top'] * dpr)
    w, h = round(m['width'] * dpr), round(m['height'] * dpr)
    best = None
    # The reported rect is before the device-pixel snap: find the true origin within a few pixels.
    for ox in range(-8, 9):
        for oy in range(-8, 9):
            x0, y0 = bx + ox, by + oy
            reg = a[y0:y0 + 224 * k, x0:x0 + 256 * k]
            if reg.shape != (224 * k, 256 * k):
                continue
            blocks = reg.reshape(224, k, 256, k)
            bad = blocks != blocks[:, 0:1, :, 0:1]
            inner = int(bad[1:-1, :, 1:-1, :].sum())
            ring = int(bad.sum()) - inner
            if best is None or inner < best[0]:
                best = (inner, ring)
    even = (w, h) == (256 * k, 224 * k)
    print(f"{vp}: scale {k}, canvas {w}x{h} device px ({'even' if even else 'UNEVEN'}); "
          f"{best[0]} stray device pixels inside, {best[1]} on the edge ring")
    ok = ok and even and best[0] == 0
sys.exit(0 if ok else 1)
