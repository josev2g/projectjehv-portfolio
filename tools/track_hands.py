"""Palm positions per hero frame, in cropped frame space (0..1), for the orb in Jose's hands.

Usage: python tools/track_hands.py [--video <path>]  (run extract_frames.py on the same video first)
Reads assets/frames/manifest.json and the raw frames in ~/.cache/projectjehv-work/, writes assets/frames/hands.json.
Optional hand-placed fixes: assets/frames/hands_overrides.json  {"<frame>": [x, y]}  (sets both hands to that point).
"""
import argparse, json, urllib.request
from pathlib import Path

import cv2
import mediapipe as mp

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "assets" / "frames"
MODEL = ROOT / "tools" / "models" / "hand_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
PALM = (0, 5, 9, 13, 17)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default="G:/My Drive/3345E187-48C1-48B7-AA8A-DF85CF5B1B4C.MP4")
    args = ap.parse_args()
    man = json.loads((FRAMES / "manifest.json").read_text())
    crop = man["crop"]
    if not MODEL.exists():
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL)

    opts = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)), num_hands=2,
        min_hand_detection_confidence=0.5, min_hand_presence_confidence=0.5)
    # Same PNGs extract_frames.py matted, so hand data lines up with the frames exactly.
    raw = Path.home() / ".cache" / "projectjehv-work" / Path(args.video).stem / f"raw_{man['srcStart']}_{man['srcEnd']}_{man['fps']}"
    pngs = sorted(raw.glob("*.png"))
    assert len(pngs) >= man["count"], f"run extract_frames.py first ({raw})"
    out = []
    with mp.tasks.vision.HandLandmarker.create_from_options(opts) as lm:
        for i in range(man["count"]):
            bgr = cv2.imread(str(pngs[i]))
            item = {"l": None, "r": None}
            if bgr is not None:
                h, w = bgr.shape[:2]
                res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)))
                for marks, hand in zip(res.hand_landmarks, res.handedness):
                    if hand[0].score < 0.5:
                        continue
                    px = sum(marks[k].x for k in PALM) / len(PALM) * w
                    py = sum(marks[k].y for k in PALM) / len(PALM) * h
                    key = "l" if hand[0].category_name == "Left" else "r"
                    if item[key]:  # both hands labelled the same side: keep both points
                        key = "r" if key == "l" else "l"
                    item[key] = [round((px - crop["x"]) / crop["w"], 4), round((py - crop["y"]) / crop["h"], 4)]
            out.append(item)

    overrides = FRAMES / "hands_overrides.json"
    if overrides.exists():
        for k, xy in json.loads(overrides.read_text()).items():
            out[int(k)] = {"l": xy, "r": xy}

    # self-check
    assert len(out) == man["count"], (len(out), man["count"])
    first = round((11.0 - man["srcStart"]) * man["fps"])
    late = out[first:]
    seen = sum(1 for p in late if p["l"] or p["r"])
    (FRAMES / "hands.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"OK {len(out)} frames; hands seen in {seen}/{len(late)} frames from 11.0 s on ({seen / max(1, len(late)):.0%})")


if __name__ == "__main__":
    main()
