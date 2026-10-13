import sys, subprocess
src, crop, cols, gamma, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
w, h = [int(v) for v in crop.split('+')[0].split('x')]
rows = round(cols*h/w)
def px(extra):
    return subprocess.run(['magick', src, '-crop', crop, '+repage', '-resize', f'{cols}x{rows}!', *extra, '-depth', '8', 'gray:-'], capture_output=True).stdout
alpha = px(['-alpha', 'extract'])
lum = px(['-background', 'black', '-flatten', '-colorspace', 'gray', '-normalize', '-unsharp', '0x1+1.5+0', '-gamma', gamma])
step = 4
dots = []
for y in range(rows):
    for x in range(cols):
        i = y*cols+x
        if alpha[i] < 128: continue
        v = lum[i]/255
        r = round(0.25 + v*1.75, 2)
        if v > 0.06: dots.append(f'<circle cx="{x*step+2}" cy="{y*step+2}" r="{r}"/>')
open(out,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cols*step} {rows*step}" width="{cols*step}" height="{rows*step}"><g fill="#fff">{"".join(dots)}</g></svg>')
print(cols*step, rows*step, len(dots))
