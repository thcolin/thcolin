import json, subprocess, sys, os
src, out, width = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '640'
frames = json.load(open(f'{src}/frames.json'))
os.makedirs(f'{src}/s', exist_ok=True)
args = ['img2webp', '-loop', '0', '-lossy', '-q', '70', '-m', '6']
for i, f in enumerate(frames):
    small = f'{src}/s/{i:04d}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f['file'], '-vf', f'scale={width}:-2:flags=lanczos', small], check=True)
    ms = frames[i + 1]['ms'] if i + 1 < len(frames) else 1200
    args += ['-d', str(ms), small]
subprocess.run(args + ['-o', out], check=True, capture_output=True)
print(out, os.path.getsize(out) // 1024, 'KB', len(frames), 'frames')
