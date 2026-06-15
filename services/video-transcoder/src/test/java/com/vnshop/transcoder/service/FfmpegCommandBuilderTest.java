package com.vnshop.transcoder.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FfmpegCommandBuilderTest {

    private final FfmpegCommandBuilder builder = new FfmpegCommandBuilder();

    @Test
    void buildTranscodeCommand_containsRequiredFlags() {
        Path input  = Path.of("/tmp/transcoder/abc/input.mp4");
        Path output = Path.of("/tmp/transcoder/abc/output_720p.mp4");

        List<String> cmd = builder.buildTranscodeCommand(input, output);

        assertThat(cmd).containsSequence("timeout", "--signal=KILL", "300");
        assertThat(cmd).containsSequence("ffmpeg", "-y");
        assertThat(cmd).containsSequence("-t", "600");
        assertThat(cmd).containsSequence("-protocol_whitelist", "file");
        assertThat(cmd).containsSequence("-i", input.toAbsolutePath().toString());
        assertThat(cmd).containsSequence("-c:v", "libx264");
        assertThat(cmd).containsSequence("-preset", "medium");
        assertThat(cmd).containsSequence("-crf", "23");
        assertThat(cmd).containsSequence("-c:a", "aac");
        assertThat(cmd).containsSequence("-b:a", "128k");
        assertThat(cmd).containsSequence("-map_metadata", "-1");
        assertThat(cmd).containsSequence("-movflags", "+faststart");
        assertThat(cmd).containsSequence("-fs", "2147483648");
        assertThat(cmd).containsSequence("-threads", "3");
        assertThat(cmd).containsSequence("-f", "mp4");
        assertThat(cmd).contains(output.toAbsolutePath().toString());
    }

    @Test
    void buildTranscodeCommand_scaleFilterPresent() {
        List<String> cmd = builder.buildTranscodeCommand(
                Path.of("/tmp/input.mov"), Path.of("/tmp/output.mp4"));

        assertThat(cmd).containsSequence("-vf",
                "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease");
    }

    @Test
    void buildPosterCommand_containsRequiredFlags() {
        Path src    = Path.of("/tmp/transcoder/abc/output_720p.mp4");
        Path poster = Path.of("/tmp/transcoder/abc/poster.jpg");

        List<String> cmd = builder.buildPosterCommand(src, poster, 3.5);

        assertThat(cmd).containsSequence("ffmpeg", "-y");
        assertThat(cmd).containsSequence("-ss", "3.5");
        assertThat(cmd).containsSequence("-i", src.toAbsolutePath().toString());
        assertThat(cmd).containsSequence("-frames:v", "1");
        assertThat(cmd).containsSequence("-q:v", "2");
        assertThat(cmd).contains(poster.toAbsolutePath().toString());
    }

    @ParameterizedTest(name = "duration={0}s -> seek={1}s")
    @CsvSource({
            "0,   1.0",
            "-5,  1.0",
            "5,   1.0",   // 5 * 0.1 = 0.5 -> clamp to 1.0
            "10,  1.0",   // 10 * 0.1 = 1.0 -> exactly 1.0
            "20,  2.0",   // 20 * 0.1 = 2.0
            "100, 10.0",  // 100 * 0.1 = 10.0
            "600, 60.0",  // 600 * 0.1 = 60.0
    })
    void posterSeekSeconds_clampsToMinimumOneSecond(double duration, double expectedSeek) {
        assertThat(builder.posterSeekSeconds(duration)).isEqualTo(expectedSeek);
    }
}
