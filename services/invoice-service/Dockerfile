FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace
COPY services/invoice-service/pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn dependency:go-offline
COPY services/invoice-service/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests
RUN cd target && JAR=$(ls -S *.jar 2>/dev/null | grep -vE "(sources|javadoc|original).jar$" | head -1) && mv "$JAR" app.jar

FROM eclipse-temurin:21-jre-alpine AS runner
RUN apk upgrade --no-cache && apk add --no-cache curl && addgroup -g 1000 vnshop && adduser -D -u 1000 -G vnshop vnshop
WORKDIR /app
COPY --from=builder /workspace/target/app.jar app.jar
RUN chown -R vnshop:vnshop /app
USER vnshop
EXPOSE 8098
HEALTHCHECK --interval=30s --timeout=20s --start-period=30s --retries=3 CMD curl -f http://localhost:8098/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
