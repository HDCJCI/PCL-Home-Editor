# -*- coding: utf-8 -*-
"""生成一个 256x256 的 ICO（PNG 编码）：圆角蓝底 + 白色 P"""
import struct, zlib, math

S = 1024          # 超采样尺寸
N = 256           # 最终尺寸


def lerp(a, b, t):
    return a + (b - a) * t


def rounded_rect(x, y, w, h, r):
    """返回布尔遮罩函数"""
    def f(px, py):
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return f


def in_rect(px, py, x, y, w, h):
    return x <= px <= x + w and y <= py <= y + h


def circle(px, py, cx, cy, r):
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


# 背景圆角方块
bg = rounded_rect(56, 56, 912, 912, 200)
# P 的几何（在 1024 画布上）
stem = (380, 300, 120, 430)          # x,y,w,h
bowl_cx, bowl_cy, bowl_r = 540, 400, 150
hole_r = 68


def sample(px, py):
    if not bg(px, py):
        return (0, 0, 0, 0)
    # 背景：竖向渐变
    t = (py - 56) / 912.0
    r = int(lerp(104, 34, t))
    g = int(lerp(178, 116, t))
    b = int(lerp(255, 205, t))
    # 白色 P
    white = False
    if in_rect(px, py, *stem):
        white = True
    if circle(px, py, bowl_cx, bowl_cy, bowl_r) and not circle(px, py, bowl_cx, bowl_cy, hole_r):
        white = True
    if white:
        return (255, 255, 255, 255)
    return (r, g, b, 255)


rows = []
step = S // N
for oy in range(N):
    row = bytearray()
    for ox in range(N):
        ar = ag = ab = aa = 0
        cnt = 0
        for sy in range(step):
            for sx in range(step):
                c = sample(ox * step + sx + 0.5, oy * step + sy + 0.5)
                ar += c[0] * c[3]
                ag += c[1] * c[3]
                ab += c[2] * c[3]
                aa += c[3]
                cnt += 1
        if aa == 0:
            row += bytes((0, 0, 0, 0))
        else:
            row += bytes((ar // aa, ag // aa, ab // aa, aa // cnt))
    rows.append(bytes(row))

raw = b''.join(b'\x00' + r for r in rows)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(raw, 9))
png += chunk(b'IEND', b'')

ico = struct.pack('<HHH', 0, 1, 1)
ico += struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(png), 22)
ico += png

open('app.ico', 'wb').write(ico)
open('icon-preview.png', 'wb').write(png)
print('icon ok', len(ico), 'bytes')
