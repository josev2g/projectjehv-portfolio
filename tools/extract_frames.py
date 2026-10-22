"""Turn Jose's turning video into transparent, graded WebP frames for the hero.

Usage (venv lives outside Google Drive, see tools/README.md):
  python tools/extract_frames.py --video "G:/My Drive/<take>.MP4" [--start 1.0] [--end 18.5] [--fps 10] [--test N]

--test N mattes only N evenly spaced frames and writes a contact sheet to the work dir; assets/ is untouched.
"""
import argparse, json, math, shutil, subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "frames"
WORK = Path.home() / ".cache" / "projectjehv-work"
NAVY = (11, 19, 40)
CYAN = np.array([96, 188, 231], dtype=np.float32)
DESKTOP_H, MOBILE_H, QUALITY = 1400, 900, 82


def extract_raw(video, start, end, fps, dst):
    dst.mkdir(parents=True, exist_ok=True)
    if not any(dst.glob("*.png")):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", video, "-t", str(end - start),
                        "-vf", f"fps={fps}", str(dst / "%04d.png")], check=True)
    return sorted(dst.glob("*.png"))


def matte(paths, cache, session):
    cache.mkdir(parents=True, exist_ok=True)
    masks = []
    for i, p in enumerate(paths):
        m = cache / p.name
        if not m.exists():
            remove(Image.open(p).convert("RGB"), session=session, only_mask=True).save(m)
            print(f"matte {i + 1}/{len(paths)}", flush=True)
        masks.append(m)
    return masks


def crop_box(masks, size):
    """One fixed crop for every frame: union of the person's bounding boxes, cut knees-up."""
    boxes = [Image.open(m).point(lambda v: 255 if v > 128 else 0).getbbox() for m in masks]
    boxes = [b for b in boxes if b]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    w, h = size
    pad_x, pad_top = int((x1 - x0) * 0.06), int((y1 - y0) * 0.04)
    x0, x1, y0 = max(0, x0 - pad_x), min(w, x1 + pad_x), max(0, y0 - pad_top)
    y1 = min(h, y0 + int((y1 - y0) * 0.78) + pad_top)
    return x0, y0, x1 - x0, y1 - y0


def grade(rgb_img, mask_img):
    """Cool the warm indoor light toward the brand, add a faint cyan rim, fade the bottom."""
    rgb = np.asarray(rgb_img, dtype=np.float32) / 255
    a = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255
    rgb[..., 0] *= 0.92
    rgb[..., 2] = np.minimum(1, rgb[..., 2] * 1.06)
    rgb = rgb ** 1.08
    inner = np.asarray(mask_img.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
    rim = np.clip(a - inner, 0, 1)[..., None] * 0.55
    rgb = np.clip(rgb * 255 * (1 - rim) + CYAN * rim, 0, 255)
    h = a.shape[0]
    fade_from = int(h * (1 - 0.18))
    a[fade_from:] *= np.linspace(1, 0, h - fade_from, dtype=np.float32)[:, None]
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")


def build_frame(raw, mask, box):
    x, y, w, h = box
    region = (x, y, x + w, y + h)
    return grade(Image.open(raw).convert("RGB").crop(region), Image.open(mask).convert("L").crop(region))


def scaled(img, target_h):
    h = min(target_h, img.height)  # never upscale
    return img.resize((round(img.width * h / img.height), h), Image.LANCZOS)


def contact_sheet(frames, dst):
    th = 480
    tiles = [scaled(f, th) for f in frames]
    sheet = Image.new("RGB", (sum(t.width for t in tiles) + 8 * len(tiles), th), NAVY)
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0), t)
        x += t.width + 8
    sheet.save(dst, quality=90)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--start", type=float, default=1.6)  # Jose standing straight, before he turns
    ap.add_argument("--end", type=float, default=18.5)
    ap.add_argument("--fps", type=int, default=10)
    ap.add_argument("--test", type=int, default=0)
    ap.add_argument("--model", default="birefnet-portrait")
    args = ap.parse_args()

    work = WORK / Path(args.video).stem
    run = f"{args.start}_{args.end}_{args.fps}"
    raws = extract_raw(args.video, args.start, args.end, args.fps, work / f"raw_{run}")
    if args.test:
        raws = [raws[round(i * (len(raws) - 1) / (args.test - 1))] for i in range(args.test)]
    # masks are cached by file name, so each start/end/fps gets its own folder (0001.png means a different moment in each)
    masks = matte(raws, work / f"mask_{args.model}_{run}", new_session(args.model))
    box = crop_box(masks, Image.open(raws[0]).size)

    if args.test:
        dst = work / "test"
        dst.mkdir(exist_ok=True)
        contact_sheet([build_frame(r, m, box) for r, m in zip(raws, masks)], dst / "sheet.jpg")
        print(f"test sheet: {dst / 'sheet.jpg'}  crop={box}")
        return

    for sub in ("desktop", "mobile"):
        shutil.rmtree(OUT / sub, ignore_errors=True)
        (OUT / sub).mkdir(parents=True)
    dims = {}
    for i, (r, m) in enumerate(zip(raws, masks)):
        frame = build_frame(r, m, box)
        d = scaled(frame, DESKTOP_H)
        d.save(OUT / "desktop" / f"f_{i:03d}.webp", quality=QUALITY, method=4)
        dims["desktop"] = {"w": d.width, "h": d.height, "step": 1}
        if i == 0:
            d.save(OUT / "poster.webp", quality=QUALITY, method=4)
        if i % 2 == 0:
            s = scaled(frame, MOBILE_H)
            s.save(OUT / "mobile" / f"f_{i // 2:03d}.webp", quality=QUALITY, method=4)
            dims["mobile"] = {"w": s.width, "h": s.height, "step": 2}
    count = len(raws)
    manifest = {"fps": args.fps, "srcStart": args.start, "srcEnd": args.end, "count": count, **dims,
                "crop": dict(zip("xywh", box))}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # self-check
    desk, mob = sorted((OUT / "desktop").glob("*.webp")), sorted((OUT / "mobile").glob("*.webp"))
    assert len(desk) == count, (len(desk), count)
    assert len(mob) == math.ceil(count / 2), (len(mob), count)
    first = Image.open(desk[0])
    assert first.mode == "RGBA"
    assert first.getpixel((0, 0))[3] == 0, "corner of frame 0 should be transparent"
    print(f"OK {count} frames  desktop {dims['desktop']['w']}x{dims['desktop']['h']}  mobile {dims['mobile']['w']}x{dims['mobile']['h']}")


if __name__ == "__main__":
    main()
