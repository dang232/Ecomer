package com.vnshop.transcoder.service;

import com.vnshop.transcoder.config.TranscoderProperties;
import org.springframework.stereotype.Component;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import java.nio.file.Path;
import java.util.List;

/**
 * Builds the FFmpeg and poster-extraction command lists.
 * Pure value object — no I/O, fully unit-testable.
 */
@Component
@EnableConfigurationProperties(TranscoderProperties.class)
public class FfmpegCommandBuilder {
    private final TranscoderProperties properties;

    public FfmpegCommandBuilder(TranscoderProperties properties) {
        this.properties = properties;
    }

    /**
     * Builds the transcode command that:
     * - caps wall-clock time at 300 s (SIGKILL)
     * - strips input to first 600 s
     * - scales down to max 1280x720 preserving aspect ratio
     * - encodes H.264/AAC, faststart, strips metadata
     * - limits output to 2 GiB
     * - uses 3 threads
     *
     * @param inputFile  local path to the downloaded raw file
     * @param outputFile local path for the 720p MP4 output
     */
    public List<String> buildTranscodeCommand(Path inputFile, Path outputFile) {
        return List.of(
                "timeout", "--signal=KILL", String.valueOf(properties.processTimeoutSeconds()),
                "ffmpeg", "-y",
                "-t", String.valueOf(properties.inputDurationLimitSeconds()),
                "-protocol_whitelist", "file",
                "-i", inputFile.toAbsolutePath().toString(),
                "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-map", "0:v:0",
                "-map", "0:a:0",
                "-map_metadata", "-1",
                "-movflags", "+faststart",
                "-fs", String.valueOf(properties.outputSizeLimitBytes()),
                "-threads", String.valueOf(properties.ffmpegThreads()),
                "-f", "mp4",
                outputFile.toAbsolutePath().toString()
        );
    }

    /**
     * Builds the FFmpeg command to extract a single poster frame at
     * {@code seekSeconds} from the transcoded file.
     *
     * @param transcodedFile source 720p MP4
     * @param posterFile     destination JPEG path
     * @param seekSeconds    seek position (seconds); must be &gt;= 0
     */
    public List<String> buildPosterCommand(Path transcodedFile, Path posterFile, double seekSeconds) {
        return List.of(
                "ffmpeg", "-y",
                "-ss", String.valueOf(seekSeconds),
                "-i", transcodedFile.toAbsolutePath().toString(),
                "-frames:v", "1",
                "-q:v", "2",
                posterFile.toAbsolutePath().toString()
        );
    }

    /**
     * Calculates the seek position for poster extraction:
     * {@code max(1.0, duration * 0.1)} seconds.
     *
     * @param durationSeconds total duration of the video; &lt;= 0 defaults to 1.0
     */
    public double posterSeekSeconds(double durationSeconds) {
        if (durationSeconds <= 0) {
            return 1.0;
        }
        return Math.max(1.0, durationSeconds * 0.1);
    }
}
