# Build from project root: docker build -f Dockerfile .
# Downloads the PocketBase Linux binary for the build arch; pb_hooks are copied from the repo.

FROM alpine:3
RUN apk add --no-cache unzip ca-certificates wget

# PocketBase version (no 'v' prefix in asset filename)
ARG PB_VERSION=0.36.2
# Docker BuildKit sets these for the target platform (e.g. linux/amd64, linux/arm64)
# Fallbacks are computed at build time if BuildKit isn't providing them.
ARG TARGETOS=linux
ARG TARGETARCH=amd64

WORKDIR /app

# Download and extract PocketBase binary for this arch
RUN arch="${TARGETARCH}"; \
    if [ -z "$arch" ] || [ "$arch" = "amd64" ] && [ -z "${TARGETPLATFORM}" ]; then \
      case "$(uname -m)" in \
        x86_64) arch="amd64" ;; \
        aarch64|arm64) arch="arm64" ;; \
        armv7l) arch="armv7" ;; \
        *) echo "Unsupported arch: $(uname -m)"; exit 1 ;; \
      esac; \
    fi; \
    wget -q -O /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${TARGETOS}_${arch}.zip" \
    && unzip -o /tmp/pb.zip -d /tmp/pb \
    && mv /tmp/pb/pocketbase . \
    && rm -rf /tmp/pb /tmp/pb.zip

# Hooks (must be next to executable for PocketBase to load them)
COPY pocketbase/pb_hooks ./pb_hooks

# Env (override at run; SITE_DEPLOY_TOKEN is required for deploy API)
ENV SITE_ROOT=/site \
    SITE_URL=https://www.example.com
# Mounts: -v /srv/pb/data:/app/pb_data -v /srv/site:/site
# Port: -p 127.0.0.1:8090:8090

EXPOSE 8090
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
