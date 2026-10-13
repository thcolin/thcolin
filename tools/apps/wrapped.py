# Downscales the 2x captures of wrapped.mjs (supersampled) and assembles both webps
import os, subprocess
from concurrent.futures import ThreadPoolExecutor
from common import magick, assemble, sheet, fresh

HERE = os.path.dirname(os.path.abspath(__file__))
SCALE = 360 / 804  # screen 402 css px captured at 2x, out at 360 px: 2x for 180 px

def run(kind, q):
    src, out = f'{HERE}/work-wrapped/{kind}', f'{HERE}/frames-wrapped-{kind}'
    fresh(out)
    names = sorted(os.listdir(src))
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda n: magick(f'{src}/{n}', '-filter', 'Lanczos', '-resize', f'{SCALE * 100:.4f}%', f'{out}/{n}'), names))
    print(kind, assemble(out, f'{HERE}/wrapped-{kind}.webp', q=q), os.path.getsize(f'{HERE}/wrapped-{kind}.webp'))
    sheet(out, f'{HERE}/sheet-wrapped-{kind}.png', '5x', 300, bg='#777', offset=0.75)

run('screen', 85)
run('phone', 85)
