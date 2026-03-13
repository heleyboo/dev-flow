FROM eclipse-temurin:{{version}}-jdk

WORKDIR /app

COPY . .

RUN ./mvnw install -DskipTests 2>/dev/null || true

EXPOSE {{port}}

CMD ["./mvnw", "spring-boot:run"]
