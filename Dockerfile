# Build from project root: docker build -f Dockerfile .
# Downloads the PocketBase Linux binary for the build arch; pb_hooks are copied from the repo.

FROM alpine:3.19
RUN apk add --no-cache unzip ca-certificates wget

# PocketBase version (no 'v' prefix in asset filename)
ARG PB_VERSION=0.36.2
# Docker BuildKit sets these for the target platform (e.g. linux/amd64, linux/arm64)
ARG TARGETOS=linux
ARG TARGETARCH=amd64

WORKDIR /app

# Download and extract PocketBase binary for this arch
RUN wget -q -O /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${TARGETOS}_${TARGETARCH}.zip" \
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
CMD ["./pocketbase", "serve"]
