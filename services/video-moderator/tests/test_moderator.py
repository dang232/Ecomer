"""Unit tests for Moderator — frame extraction + NudeNet scoring logic."""

import os
import shutil
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.moderator import Moderator, _score_frame


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def settings():
    return Settings(
        frame_interval_seconds=5,
        tmp_dir=tempfile.mkdtemp(prefix="test-moderator-"),
        nsfw_threshold_auto_approve=0.3,
        nsfw_threshold_auto_reject=0.7,
    )


@pytest.fixture
def mock_detector():
    """A NudeDetector stub that returns no detections by default."""
    detector = MagicMock()
    detector.detect.return_value = []
    return detector


@pytest.fixture
def moderator(settings, mock_detector):
    with patch("app.moderator.Moderator._load_detector", return_value=mock_detector):
        m = Moderator(settings)
    m._detector = mock_detector
    yield m
    shutil.rmtree(settings.tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# _score_frame unit tests
# ---------------------------------------------------------------------------

class TestScoreFrame:
    def test_returns_zero_when_no_detections(self, mock_detector):
        mock_detector.detect.return_value = []
        score = _score_frame(mock_detector, "frame.jpg")
        assert score == 0.0

    def test_returns_zero_when_no_nsfw_labels(self, mock_detector):
        mock_detector.detect.return_value = [{"label": "UNKNOWN_LABEL", "score": 0.9, "box": []}]
        score = _score_frame(mock_detector, "frame.jpg")
        assert score == 0.0

    def test_returns_max_score_across_detections(self, mock_detector):
        mock_detector.detect.return_value = [
            {"label": "EXPOSED_BREAST_F", "score": 0.4, "box": []},
            {"label": "EXPOSED_PENIS", "score": 0.85, "box": []},
            {"label": "FACE_F", "score": 0.95, "box": []},
        ]
        score = _score_frame(mock_detector, "frame.jpg")
        # FACE_F is in _NSFW_LABELS, EXPOSED_PENIS also — max is 0.95
        assert score == pytest.approx(0.95)

    def test_returns_zero_on_detector_exception(self, mock_detector):
        mock_detector.detect.side_effect = RuntimeError("model error")
        score = _score_frame(mock_detector, "frame.jpg")
        assert score == 0.0


# ---------------------------------------------------------------------------
# Moderator.analyze_video integration-style tests (ffmpeg mocked)
# ---------------------------------------------------------------------------

class TestAnalyzeVideo:
    def test_returns_zero_when_no_frames_extracted(self, moderator, tmp_path):
        video_path = str(tmp_path / "empty.mp4")
        # Touch an empty file so the path exists
        open(video_path, "w").close()

        with patch("app.moderator._extract_frames", return_value=[]):
            score = moderator.analyze_video(video_path)

        assert score == 0.0

    def test_returns_max_score_across_frames(self, moderator, tmp_path):
        video_path = str(tmp_path / "video.mp4")
        open(video_path, "w").close()

        frames = ["frame_0001.jpg", "frame_0002.jpg", "frame_0003.jpg"]
        frame_scores = [0.1, 0.65, 0.2]

        def fake_score(detector, frame_path):
            idx = frames.index(frame_path)
            return frame_scores[idx]

        with patch("app.moderator._extract_frames", return_value=frames), \
             patch("app.moderator._score_frame", side_effect=fake_score):
            score = moderator.analyze_video(video_path)

        assert score == pytest.approx(0.65)

    def test_cleans_up_work_dir_on_success(self, moderator, tmp_path, settings):
        video_path = str(tmp_path / "video.mp4")
        open(video_path, "w").close()

        created_dirs = []

        original_makedirs = os.makedirs

        def track_makedirs(path, **kwargs):
            if "frames-" in path:
                created_dirs.append(path)
            original_makedirs(path, **kwargs)

        with patch("os.makedirs", side_effect=track_makedirs), \
             patch("app.moderator._extract_frames", return_value=[]), \
             patch("shutil.rmtree") as mock_rmtree:
            moderator.analyze_video(video_path)

        # rmtree should have been called for the work dir
        assert mock_rmtree.called

    def test_cleans_up_work_dir_on_exception(self, moderator, tmp_path):
        video_path = str(tmp_path / "video.mp4")
        open(video_path, "w").close()

        with patch("app.moderator._extract_frames", side_effect=RuntimeError("ffmpeg crash")), \
             patch("shutil.rmtree") as mock_rmtree:
            with pytest.raises(RuntimeError, match="ffmpeg crash"):
                moderator.analyze_video(video_path)

        assert mock_rmtree.called
