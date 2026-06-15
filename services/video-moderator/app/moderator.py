"""NudeNet v3 ONNX inference for NSFW detection on video frames."""

import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from app.config import Settings

logger = logging.getLogger(__name__)

# NudeNet label that carries the highest risk weight.
# We take the MAX score across all labels and all frames.
_NSFW_LABELS = {
    "EXPOSED_ANUS",
    "EXPOSED_ARMPITS",
    "COVERED_BELLY",
    "EXPOSED_BELLY",
    "COVERED_BUTTOCKS",
    "EXPOSED_BUTTOCKS",
    "FACE_F",
    "FACE_M",
    "COVERED_FEET",
    "EXPOSED_FEET",
    "COVERED_BREAST_F",
    "EXPOSED_BREAST_F",
    "COVERED_GENITALIA_F",
    "EXPOSED_GENITALIA_F",
    "EXPOSED_PENIS",
    "COVERED_PENIS",
}

# Labels that indicate explicit nudity; weighted higher in the aggregation.
_EXPLICIT_LABELS = {
    "EXPOSED_GENITALIA_F",
    "EXPOSED_PENIS",
    "EXPOSED_BREAST_F",
    "EXPOSED_ANUS",
}


def _extract_frames(video_path: str, output_dir: str, interval_seconds: int) -> list[str]:
    """Extract one frame per *interval_seconds* from *video_path* into *output_dir*.

    Uses ffmpeg's fps video filter. Returns sorted list of output frame paths.
    """
    fps = f"1/{interval_seconds}"
    pattern = os.path.join(output_dir, "frame_%04d.jpg")
    cmd = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vf", f"fps={fps}",
        "-q:v", "2",
        pattern,
    ]
    logger.debug("Extracting frames: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg frame extraction failed: {result.stderr}")

    frames = sorted(Path(output_dir).glob("frame_*.jpg"))
    logger.info("Extracted %d frames from %s", len(frames), video_path)
    return [str(f) for f in frames]


def _score_frame(detector, frame_path: str) -> float:
    """Return the maximum NSFW score for a single frame.

    NudeNet detect() returns a list of dicts with keys: label, score, box.
    Explicit labels are returned as-is; the function returns the max score.
    """
    try:
        detections = detector.detect(frame_path)
    except Exception:
        logger.warning("NudeNet failed on frame %s — scoring 0.0", frame_path, exc_info=True)
        return 0.0

    if not detections:
        return 0.0

    scores = [d["score"] for d in detections if d.get("label") in _NSFW_LABELS]
    explicit_scores = [d["score"] for d in detections if d.get("label") in _EXPLICIT_LABELS]

    # Explicit detections are passed through directly; others are kept as-is.
    all_scores = scores + explicit_scores
    return max(all_scores) if all_scores else 0.0


class Moderator:
    """Wraps NudeNet v3 ONNX detector and frame-level aggregation logic."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._detector = self._load_detector()

    def _load_detector(self):
        """Lazily load the NudeNet detector so startup is fast."""
        try:
            from nudenet import NudeDetector  # type: ignore[import]
            return NudeDetector()
        except ImportError:
            logger.error(
                "nudenet package not installed — install via requirements.txt"
            )
            raise

    def analyze_video(self, video_path: str) -> float:
        """Extract frames and return max NSFW score across the full video.

        Returns a float in [0.0, 1.0].
        """
        work_dir = os.path.join(
            self._settings.tmp_dir, f"frames-{uuid.uuid4().hex}"
        )
        os.makedirs(work_dir, exist_ok=True)
        try:
            frames = _extract_frames(
                video_path,
                work_dir,
                self._settings.frame_interval_seconds,
            )
            if not frames:
                logger.warning("No frames extracted from %s — returning score 0.0", video_path)
                return 0.0

            scores = [_score_frame(self._detector, f) for f in frames]
            max_score = max(scores)
            logger.info(
                "Analyzed %d frames — max_nsfw_score=%.4f path=%s",
                len(frames),
                max_score,
                video_path,
            )
            return max_score
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)
