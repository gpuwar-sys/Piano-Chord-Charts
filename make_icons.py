"""Build the launcher icons. Run from anywhere: python www/make_icons.py"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent / "www" / "icons"

GREEN = (31, 77, 69, 255)
CREAM = (247, 243, 234, 255)


def write_png(path, size, pixels):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw.extend(pixels[y])
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def icon(size):
    pixels = []
    radius = size * 0.22
    for y in range(size):
        row = bytearray()
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = dx >= radius or dy >= radius or (radius - dx) ** 2 + (radius - dy) ** 2 <= radius ** 2
            if not inside:
                row.extend((0, 0, 0, 0))
                continue
            # Note head
            cx, cy, rx, ry = size * 0.40, size * 0.68, size * 0.16, size * 0.13
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            on = nx * nx + ny * ny <= 1
            # Stem
            if size * 0.50 <= x <= size * 0.58 and size * 0.22 <= y <= size * 0.70:
                on = True
            # Flag
            if y < size * 0.42 and x >= size * 0.52:
                flag_y = size * 0.24 + (x - size * 0.52) * 0.55
                if abs(y - flag_y) <= size * 0.045 and x < size * 0.78:
                    on = True
            row.extend(CREAM if on else GREEN)
        pixels.append(row)
    return pixels


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        write_png(OUT / f"icon-{size}.png", size, icon(size))
        print(OUT / f"icon-{size}.png")


if __name__ == "__main__":
    main()
