# Deploy image to Docker Hub

Build the image, tag it for your Docker Hub repo, then push.

## 1. Log in

```bash
docker login
```

Use your Docker Hub username and password (or a [Personal Access Token](https://hub.docker.com/settings/security) for password).

## 2. Tag the image

Replace `YOUR_USERNAME` with your Docker Hub username and `REPO` with the repo name (e.g. `transformable-app-container`). Use a tag like `latest` or a version (e.g. `0.36.2`).

```bash
docker tag transformable-app-container YOUR_USERNAME/REPO:latest
```

Example:

```bash
docker tag transformable-app-container myuser/transformable-app-container:latest
```

## 3. Push

```bash
docker push YOUR_USERNAME/REPO:latest
```

Example:

```bash
docker push myuser/transformable-app-container:latest
```

## One-shot (build, tag, push)

From project root, after `docker login`:

```bash
docker build -t transformable-app-container .
docker tag transformable-app-container YOUR_USERNAME/REPO:latest
docker push YOUR_USERNAME/REPO:latest
```

## Multi-platform (optional)

To publish an image that runs on both `linux/amd64` and `linux/arm64`, use buildx and push the manifest:

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t YOUR_USERNAME/REPO:latest \
  --push .
```

Create the repo on [Docker Hub](https://hub.docker.com/repository/create) first (e.g. `YOUR_USERNAME/transformable-app-container`) if it doesn’t exist. Others can then run your image with:

```bash
docker run -d --name pocketbase ... -e SITE_DEPLOY_TOKEN=... YOUR_USERNAME/transformable-app-container:latest
```

(Use the same env and mounts as in [DEPLOY.md](DEPLOY.md#docker).)
