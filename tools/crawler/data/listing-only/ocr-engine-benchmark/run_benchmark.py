#!/usr/bin/env python3
"""Run a local OCR comparison on the frozen 22043 brochure sample."""

import hashlib
import importlib.metadata
import io
import json
import os
import subprocess
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[4]
MANIFEST_PATH = Path(os.environ.get("OCR_BENCHMARK_MANIFEST", BASE / "manifest.json"))
RESULT_PATH = Path(os.environ.get("OCR_BENCHMARK_RESULT", BASE / "results.json"))
PROGRESS_PATH = Path(os.environ.get("OCR_BENCHMARK_PROGRESS", BASE / ".progress.json"))
MODEL_CACHE = BASE / "paddle-cache"

for directory in (MODEL_CACHE, BASE / "xdg-cache", BASE / "hf-cache", BASE / "tmp"):
    directory.mkdir(parents=True, exist_ok=True)

for name, value in {
    "PADDLE_PDX_CACHE_HOME": str(MODEL_CACHE),
    "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK": "1",
    "XDG_CACHE_HOME": str(BASE / "xdg-cache"),
    "HF_HOME": str(BASE / "hf-cache"),
    "TMPDIR": str(BASE / "tmp"),
    "PYTHONDONTWRITEBYTECODE": "1",
    "HF_HUB_OFFLINE": "1",
    "MODELSCOPE_OFFLINE": "1",
}.items():
    os.environ[name] = value

from PIL import Image, ImageOps  # noqa: E402
from paddleocr import PaddleOCR  # noqa: E402


def atomic_write_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def run_tesseract(image_bytes: bytes, psm: int) -> dict[str, object]:
    started = time.perf_counter()
    result = subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", "deu+eng", "--oem", "1", "--psm", str(psm), "tsv"],
        input=image_bytes,
        capture_output=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))

    lines: dict[tuple[str, str, str, str], list[dict[str, object]]] = {}
    tsv_lines = result.stdout.decode("utf-8", errors="replace").splitlines()
    for row in tsv_lines[1:]:
        # Tesseract TSV does not escape quotes in its final text column. A CSV
        # parser can therefore treat later rows as quoted multiline content.
        fields = row.split("\t", maxsplit=11)
        if len(fields) != 12 or fields[0] != "5":
            continue
        text = fields[11].strip()
        try:
            confidence = float(fields[10])
        except ValueError:
            continue
        if not text or confidence < 0:
            continue
        key = (fields[2], fields[3], fields[4], fields[1])
        lines.setdefault(key, []).append({"text": text, "confidence": confidence})

    text_lines = [" ".join(word["text"] for word in words) for words in lines.values()]
    words = [word for line in lines.values() for word in line]
    return {
        "text": "\n".join(text_lines),
        "wordCount": len(words),
        "meanWordConfidence": round(sum(word["confidence"] for word in words) / len(words), 2) if words else None,
        "elapsedSeconds": round(time.perf_counter() - started, 3),
    }


def upscale_for_tesseract(image_bytes: bytes) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as image:
        grayscale = ImageOps.autocontrast(image.convert("L"))
        width, height = grayscale.size
        scaled = grayscale.resize((round(width * 1.5), round(height * 1.5)), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        scaled.save(output, format="PNG", optimize=True)
        return output.getvalue()


def run_paddle(ocr: PaddleOCR, image_path: Path) -> dict[str, object]:
    started = time.perf_counter()
    results = ocr.predict(str(image_path))
    if not results:
        return {"textLines": [], "elapsedSeconds": round(time.perf_counter() - started, 3)}
    payload = results[0].json["res"]
    return {
        "textLines": [
            {"text": text, "confidence": round(float(score), 4), "box": [int(value) for value in box]}
            for text, score, box in zip(
                payload.get("rec_texts", []),
                payload.get("rec_scores", []),
                payload.get("rec_boxes", []),
                strict=True,
            )
        ],
        "elapsedSeconds": round(time.perf_counter() - started, 3),
    }


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    manifest_digest = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    try:
        previous = json.loads(PROGRESS_PATH.read_text())
    except FileNotFoundError:
        previous = {}
    completed = previous.get("byPage", {}) if previous.get("manifestSha256") == manifest_digest else {}
    repair_tesseract = os.environ.get("OCR_BENCHMARK_REPAIR_TESSERACT") == "1"

    paddle = PaddleOCR(
        lang="german",
        ocr_version="PP-OCRv6",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        text_det_limit_side_len=1600,
        text_det_limit_type="max",
        engine="paddle",
    )

    for index, page in enumerate(manifest["pages"], start=1):
        key = f"{page['brn']}#page-{page['pageNumber']}"
        if key in completed and not repair_tesseract:
            continue
        image_path = ROOT / page["imagePath"]
        image_bytes = image_path.read_bytes()
        actual_hash = hashlib.sha256(image_bytes).hexdigest()
        if actual_hash != page["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {image_path}: {actual_hash}")

        started = time.perf_counter()
        paddle_result = completed.get(key, {}).get("paddleOcrV6German")
        if paddle_result is None:
            paddle_result = run_paddle(paddle, image_path)
        baseline = run_tesseract(image_bytes, psm=6)
        tuned = run_tesseract(upscale_for_tesseract(image_bytes), psm=11)
        completed[key] = {
            **completed.get(key, page),
            "paddleOcrV6German": paddle_result,
            "tesseractPsm6Original": baseline,
            "tesseractPsm11Upscaled": tuned,
            "totalElapsedSeconds": round(time.perf_counter() - started, 3),
        }
        atomic_write_json(
            PROGRESS_PATH,
            {"version": 1, "manifestSha256": manifest_digest, "byPage": completed},
        )
        print(f"{index}/{len(manifest['pages'])}: {key} done", flush=True)

    total = len(completed)
    report = {
        "version": 1,
        "sampleZipCode": manifest["sampleZipCode"],
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "manifestSha256": manifest_digest,
        "scope": {
            "pagesExpected": len(manifest["pages"]),
            "pagesProcessed": total,
            "retailerNames": manifest["uniqueRetailers"],
            "sourceImagesUploaded": False,
            "cloudOcrUsed": False,
            "identityDecisionMade": False,
        },
        "engines": {
            "paddle": {
                "paddleocr": importlib.metadata.version("paddleocr"),
                "paddlepaddle": importlib.metadata.version("paddlepaddle"),
                "model": "PP-OCRv6 medium, German, text detection side limit 1600",
            },
            "tesseract": {
                "version": subprocess.run(
                    ["tesseract", "--version"], capture_output=True, text=True, check=True
                ).stdout.splitlines()[0],
                "languages": "deu+eng",
            },
        },
        "byPage": completed,
    }
    atomic_write_json(RESULT_PATH, report)
    print(f"Wrote {RESULT_PATH.relative_to(ROOT)} with {total} pages.")


if __name__ == "__main__":
    main()
