"""把导出快照里下载的原始图片压成手机可用的尺寸。

用法：python shrink-images.py <原始目录> <输出目录> [最大宽] [质量]
输出统一 .webp；单张失败只跳过，不影响整批。
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except Exception as exc:  # Pillow 不在场时让调用方回落到原图
    print(f"SKIP: 无 Pillow（{exc}）")
    sys.exit(3)

raw_dir = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
max_width = int(sys.argv[3]) if len(sys.argv) > 3 else 720
quality = int(sys.argv[4]) if len(sys.argv) > 4 else 70

out_dir.mkdir(parents=True, exist_ok=True)
done = skipped = 0
saved = 0
for src in sorted(raw_dir.iterdir()):
    if not src.is_file():
        continue
    try:
        with Image.open(src) as im:
            im.load()
            if im.width > max_width:
                im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
            out = out_dir / f"{src.stem}.webp"
            im.save(out, "WEBP", quality=quality, method=4)
            done += 1
            saved += src.stat().st_size - out.stat().st_size
    except Exception as exc:
        skipped += 1
        print(f"SKIP: {src.name} {exc}")

print(f"OK: {done} 张已转 webp · 跳过 {skipped} 张 · 省下 {saved / 1048576:.1f} MB")
