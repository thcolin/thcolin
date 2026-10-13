import hashlib, os, shutil, subprocess

FPS = 25

def bezier(x1, y1, x2, y2):
    at = lambda a, b, t: 3*a*t*(1-t)**2 + 3*b*t**2*(1-t) + t**3
    def f(x):
        lo, hi = 0.0, 1.0
        for _ in range(30):
            m = (lo + hi) / 2
            lo, hi = (m, hi) if at(x1, x2, m) < x else (lo, m)
        return at(y1, y2, (lo + hi) / 2)
    return f

def magick(*args):
    subprocess.run(['magick', *map(str, args)], check=True)

def assemble(frames_dir, out, q=80, extra=()):
    """Consecutive identical frames are merged into one, with the summed duration"""
    names = sorted(n for n in os.listdir(frames_dir) if n.endswith('.png'))
    groups = []
    for n in names:
        h = hashlib.md5(open(os.path.join(frames_dir, n), 'rb').read()).hexdigest()
        if groups and groups[-1][1] == h:
            groups[-1][2] += 1
        else:
            groups.append([n, h, 1])
    args = ['img2webp', '-loop', '0', '-lossy', '-q', str(q), '-m', '6', *extra]
    ms = 1000 / FPS
    acc = 0.0
    for n, _, c in groups:
        # durations rounded with carry, so the total stays exact
        acc += c * ms
        d = round(acc); acc -= d
        args += ['-d', str(d), os.path.join(frames_dir, n)]
    args += ['-o', out]
    subprocess.run(args, check=True, capture_output=True)
    return len(names), len(groups)

def sheet(frames_dir, out, tile, geometry, bg='#333', offset=0.0):
    names = sorted(n for n in os.listdir(frames_dir) if n.endswith('.png'))
    picks = [names[int((i + offset) * len(names) / 10)] for i in range(10)]
    # two rows of five, each frame at the given width, on a grey ground so transparency shows
    w = geometry
    row = lambda ps: ['(', *[x for p in ps for x in ('(', os.path.join(frames_dir, p), '-resize', f'{w}x', '-bordercolor', bg, '-border', '4', ')')], '+append', ')']
    magick('-background', bg, *row(picks[:5]), *row(picks[5:]), '-append', out)

def fresh(d):
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
