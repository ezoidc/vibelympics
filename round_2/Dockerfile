# Use Chainguard Wolfi base (pinned by digest)
FROM cgr.dev/chainguard/wolfi-base@sha256:0d8efc73b806c780206b69d62e1b8cb10e9e2eefa0e4452db81b9fa00b1a5175

WORKDIR /app

# Install bun and analysis tools via apk
RUN apk update && apk add --no-cache bun syft grype

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Run as non-root user
RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser
USER appuser

# Start the application
CMD ["bun", "run", "index.ts"]
