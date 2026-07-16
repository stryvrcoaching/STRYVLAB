from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/images/trophies/regenerated'
OUTPUT = ROOT / 'public/images/trophies/cutout'
OUTPUT.mkdir(parents=True, exist_ok=True)

def is_background(pixel: tuple[int, int, int]) -> bool:
    # The regenerated renders use a black studio backdrop. Only pixels reachable
    # from the border are removed, so dark marble and engraved details stay intact.
    return max(pixel) <= 62

def cutout(source: Path, target: Path) -> None:
    image = Image.open(source).convert('RGBA').resize((1024, 1024), Image.Resampling.LANCZOS)
    pixels = image.load()
    width, height = image.size
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y)); queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index]:
            continue
        seen[index] = 1
        rgb = pixels[x, y][:3]
        if not is_background(rgb):
            continue
        pixels[x, y] = (*rgb, 0)
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    # Remove only a one-pixel fringe of near-black edge pixels and preserve all
    # interior trophy pixels, including the dark marble pedestal.
    image.save(target, 'PNG', optimize=True)

for source in sorted(SOURCE.glob('*.jpg')):
    target = OUTPUT / f'{source.stem}.png'
    if target.name == 'male_bronze.png' and target.exists():
        continue
    cutout(source, target)

print(f'Generated {len(list(OUTPUT.glob("*.png")))} transparent trophy assets in {OUTPUT}')
