import os, shutil
from common import FPS, bezier, magick, assemble, sheet, fresh

A = '/Users/thcolin/Projects/perso/thcol.in/src/assets/sensorr'
HERE = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = f'{HERE}/work-sensorr', f'{HERE}/frames-sensorr'
fresh(SRC); fresh(OUT)

# 16:10 out of the 2000 x 1124 captures: the text keeps a margin on the left, the app bleeds off the right
CROP, SIZE = '1798x1124+56+0', '1200x750!'

# The band's order; each capture keeps its own steps, shortened to fit the loop (seconds)
SLIDES = [
    ('movies-tv', [2.0]),
    ('seasons', [2.0]),
    ('policies', [0.8, 0.6, 1.2]),
    ('swaps', [0.72, 0.36, 0.36, 0.28, 0.88]),
    ('report', [0.8, 0.8, 1.0]),
    ('friends', [0.52, 0.52, 0.52, 0.6]),
]

steps = []
for name, durations in SLIDES:
    src = f'{A}/{name}.webp'
    for i, d in enumerate(durations):
        png = f'{SRC}/{name}-{i}.png'
        if i == 0:
            magick(src, '-coalesce', f'{SRC}/{name}-raw-%d.png')
        magick(f'{SRC}/{name}-raw-{i}.png', '-crop', CROP, '+repage', '-resize', SIZE, '-background', '#050505', '-alpha', 'remove', '-alpha', 'off', png)
        steps.append((png, d, i == 0))

# The band's crossfade, 300 ms ease-out, at the start of each capture: the first one fades in from the last
ease = bezier(0, 0, 0.58, 1)
FADE = round(0.3 * FPS)
n = 0
prev = steps[-1][0]
for png, d, first in steps:
    count = round(d * FPS)
    for f in range(count):
        out = f'{OUT}/{n:04d}.png'
        if first and f < FADE:
            p = ease((f + 1) / (FADE + 1)) * 100
            magick(prev, png, '-compose', 'blend', '-define', f'compose:args={p:.1f}', '-composite', out)
        else:
            shutil.copy(png, out)
        n += 1
    prev = png

frames, unique = assemble(OUT, f'{HERE}/sensorr.webp', q=80)
sheet(OUT, f'{HERE}/sheet-sensorr.png', '5x', 600)
print('sensorr', n, 'frames', unique, 'unique', n / FPS, 's')
