FROM maven:3.9.11-eclipse-temurin-25 AS builder
WORKDIR /workspace
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests
RUN cd target && JAR=$(ls -S *.jar 2>/dev/null | grep -vE "(sources|javadoc|original|opentelemetry-javaagent).jar$" | head -1) && mv "$JAR" app.jar

FROM eclipse-temurin:25-jre-alpine AS runner
# Upgrade base packages and install FFmpeg + curl
RUN apk upgrade --no-cache && \
    apk add --no-cache ffmpeg curl && \
    addgroup -g 1000 vnshop && \
    adduser -D -u 1000 -G vnshop vnshop

WORKDIR /app

# tmpfs mount point for transcode work; owned by app user
RUN mkdir -p /tmp/transcoder && chown vnshop:vnshop /tmp/transcoder

COPY --from=builder /workspace/target/app.jar app.jar
RUN chown -R vnshop:vnshop /app

USER vnshop

EXPOSE 8098

HEALTHCHECK --interval=30s --timeout=20s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8098/actuator/health || exit 1

# Security hardening: no-new-privileges enforced via Docker/k8s securityContext.
# cap_drop ALL and read-only rootfs are applied at the compose/k8s layer.
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-jar", "app.jar"]
