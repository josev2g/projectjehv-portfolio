# Asset tools

These scripts turn Jose's phone video into the hero frames and hand data. They run locally, so the video never leaves the PC.

## Setup (once)

The venv lives outside Google Drive so ~1 GB of libraries does not sync:

```bash
uv venv C:/Users/JEHV/.venvs/projectjehv-portfolio --python 3.12
uv pip install --python C:/Users/JEHV/.venvs/projectjehv-portfolio -r tools/requirements.txt
```

Scratch files (raw frames, mattes, test sheets) go to `~/.cache/projectjehv-work/`. ffmpeg must be on PATH.

## Frames

```bash
PY=C:/Users/JEHV/.venvs/projectjehv-portfolio/Scripts/python
$PY tools/extract_frames.py --video "G:/My Drive/3345E187-48C1-48B7-AA8A-DF85CF5B1B4C.MP4" --test 8   # quick cutout check
$PY tools/extract_frames.py --video "G:/My Drive/3345E187-48C1-48B7-AA8A-DF85CF5B1B4C.MP4"            # full run
```

Writes `assets/frames/desktop/`, `assets/frames/mobile/`, `poster.webp` and `manifest.json`.

## Hands and graph

```bash
$PY tools/track_hands.py          # assets/frames/hands.json (needs manifest.json)
$PY tools/sanitize_graph.py       # js/graph-data.js from the second brain graph
```

## Matting test log

- 2026-10-22, Take 1, `birefnet-portrait`, 8 frames: pass. Clean edges at the cap, ears and shoulders, no curtain fringe, no holes in the hoodie. The cyan rim (0.55 strength) reads as a brand glow, not a fringe. Footage is soft (low indoor light), which is acceptable at hero size.
