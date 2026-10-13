import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import FPS, bezier, magick, assemble, fresh

A = os.path.join(os.environ.get('THCOL_IN', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'thcol.in')), 'src', 'assets', 'gmca')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f'{HERE}/frames-gmca'
fresh(OUT)

# Union of the Switch and Vita silhouettes in the 1280 x 640 heroes (86..1194, 77..563), padded for the blur;
# its centre is the hero's, where the site's scale starts from
CROP, SIZE = '1134x510+73+65', '800x360!'

# The Switch alone, through its servers
TOUR = [('switch', s) for s in ('plex', 'jellyfin', 'emby', 'stremio')]
HOLD = 1.24

# gmca-in of projects.css: from opacity 0, blur(6px), scale 0.98, 500 ms on --ease. A server change on the same
# console keeps the old screen under the new one. A console change plays gmca-in backwards on the old console
# down to nothing first, so the two consoles never share a frame
ease = bezier(0.16, 1, 0.3, 1)
IN = round(0.5 * FPS)
EXIT = round(0.3 * FPS)
BLUR = 12  # 6 css px on a hero shown about half its width

def layer(src, e):
    scale = (0.98 + 0.02 * e) * 100
    return ['(', src, '-resize', f'{scale:.3f}%', '-gravity', 'center', '-background', 'none', '-extent', '1280x640',
            '-channel', 'A', '-evaluate', 'multiply', f'{e:.4f}', '+channel',
            *(('-blur', f'0x{BLUR * (1 - e):.2f}') if e < 0.995 else ()), ')']

def frame(n, *layers):
    out = f'{OUT}/{n:04d}.png'
    args = ['-size', '1280x640', 'xc:none']
    for l in layers:
        args += [*l, '-gravity', 'center', '-composite']
    magick(*args, '-gravity', 'northwest', '-crop', CROP, '+repage', '-resize', SIZE, out)

n = 0
transitions = []
prev = TOUR[-1]
for device, server in TOUR:
    src = f'{A}/{device}-{server}.webp'
    old = f'{A}/{prev[0]}-{prev[1]}.webp'
    swap = device != prev[0]
    if swap:
        transitions.append(n)
        for f in range(EXIT):
            frame(n, layer(old, 1 - ease((f + 1) / (EXIT + 1))))
            n += 1
    for f in range(round(HOLD * FPS)):
        if f < IN:
            e = ease(f / IN)
            frame(n, *([] if swap else [layer(old, 1)]), layer(src, e))
        else:
            frame(n, [src])
        n += 1
    prev = (device, server)

frames, unique = assemble(OUT, f'{HERE}/gmca.webp', q=85)

# The frames around each console change, one row per change, on grey so transparency shows
names = sorted(os.listdir(OUT))
rows = []
for t in transitions:
    picks = [names[(t + i) % len(names)] for i in range(-1, EXIT + 5)]
    rows += ['(', *[x for p in picks for x in ('(', f'{OUT}/{p}', '-resize', '240x', '-bordercolor', '#888', '-border', '4', ')')], '+append', ')']
if rows:
    magick('-background', '#888', *rows, '-append', f'{HERE}/sheet-gmca-transition.png')
print('gmca', n, 'frames', unique, 'unique', round(n / FPS, 2), 's, console changes at', transitions)
