# transformable-container

PocketBase-backed deploy API for a single static site: deploy (zip upload), list revisions, rollback. An Nginx proxy can serve the active release from disk; PocketBase handles deploy/rollback and stores revision history.

**Skill for agents (e.g. Cursor):** The **Docker image** built from this repo is the deploy-API solution that an agent can use (deploy zip, list revisions, rollback). This **repo** can be used locally in Cursor so [skills.md](skills.md) and `.env` are ready to go when developing or testing; agents will build in `site-build/`, deploy with `./scripts/deploy.sh`.

## Docker Image

GitHub Actions publishes `ghcr.io/transformable-app/transformable-container` on `latest` and tags. Compose pulls the image by default.

**Setup:** Create host dirs and set `SITE_DEPLOY_TOKEN` and `SITE_URL` in `.env` (see [.env.example](.env.example)).

```bash
sudo mkdir -p /home/forge/site_pb_data
sudo chown -R "$(id -u):$(id -g)" /home/forge/site_pb_data
cp .env.example .env   # edit: SITE_DEPLOY_TOKEN required
```

**docker-compose example (standalone):**

```yaml
services:
  transformable:
    image: ghcr.io/transformable-app/transformable-container:latest
    container_name: transformable
    restart: unless-stopped
    ports:
      - 8090:8090
    volumes:
      - /home/forge/site_pb_data:/app/pb_data
      - /home/forge/site.example.com:/site
    environment:
      SITE_DEPLOY_TOKEN: "your-token"
      SITE_URL: "https://site.example.com"
      SITE_ROOT: "/site"
```

**Run with the repo `docker-compose.yml`:**

```bash
docker compose pull && docker compose up -d
```

### Portainer Stack Example

```yaml
services:
  transformable:
    image: ghcr.io/transformable-app/transformable-container:latest
    restart: unless-stopped
    ports:
      - 8090:8090
    volumes:
      - pb_data:/app/pb_data
      - /home/forge/site.example.com:/site
    environment:
      SITE_DEPLOY_TOKEN: "your-token"
      SITE_URL: "https://site.example.com"
      SITE_ROOT: "/site"
volumes:
  pb_data:
```

### Proxy (Nginx)

Docker exposes port `8090` on the host. Bind to `127.0.0.1` and put a reverse proxy (e.g. Nginx) in front. The **site directory** and **PocketBase port** are configured at the proxy (e.g. a self-hosted subdomain with SSL).

- **Site directory** — The container writes releases under the mounted site path (e.g. `/site` → `/home/forge/site.example.com`), and updates a `current` symlink to the active release. In Nginx, set `root` (or `alias`) to that path plus `current`, e.g. `root /home/forge/site.example.com/current`. You can use a different host path as long as the same path is mounted into the container and Nginx is pointed at it.
- **PocketBase port** — Bind PocketBase to `127.0.0.1:8090` (or another local port). In Nginx, use `proxy_pass` to that address for the API and Admin UI (e.g. `location /api`, `location /_/`). TLS and public hostnames are then handled by Nginx.

Example configs: [docs/DEPLOY.md](docs/DEPLOY.md#nginx-on-host).

## Quick start (non-Docker)

1. The `revisions` collection is created automatically on PocketBase start (see [docs/SCHEMA.md](docs/SCHEMA.md)).
2. Set `SITE_DEPLOY_TOKEN` (and optionally `SITE_ROOT`, `SITE_URL`). Use [.env.example](.env.example) as a template; copy to `.env` or `.cursor.env` and never commit secrets.
3. Run PocketBase locally: [docs/DEPLOY.md](docs/DEPLOY.md#local-run-no-docker).
4. Deploy: build in `site-build/`, zip to `site-build/site.zip`, then run `./scripts/deploy.sh` (or `POST /api/site/deploy` with the zip and Bearer token). See [skills.md](skills.md) for API details (placeholders; substitute from env at runtime).

## Repo layout

- **pocketbase/** — PocketBase binary and [pb_hooks](pocketbase/pb_hooks/) (deploy, rollback, revisions, delete hook).
- **docs/** — [SCHEMA.md](docs/SCHEMA.md) (revisions collection + singleton), [DEPLOY.md](docs/DEPLOY.md) (host paths, Docker, Nginx).
- **skills.md** — API map for Cursor (placeholders `{{PB_BASE_URL}}`, `{{SITE_DEPLOY_TOKEN}}`).
- **docker-compose.yml** — Production compose
- **Dockerfile** — Downloads the PocketBase Linux binary for the build arch and copies `pb_hooks`. Default env: `SITE_ROOT=/site`, `SITE_URL=...`. Run with `-v /home/forge/site.example.com/pb_data:/app/pb_data -v /home/forge/site.example.com:/site` and `-e SITE_DEPLOY_TOKEN=...`; see [docs/DEPLOY.md](docs/DEPLOY.md).

## API (3 routes)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/site/deploy | Bearer token | Upload zip (multipart `file`, optional `message`); extract, flip `current`, return `currentRevisionId`, `url`, `message`. |
| GET | /api/site/revisions?limit=20 | Bearer token | List current revision id and recent revisions. |
| POST | /api/site/rollback | Bearer token | Body `{ "revisionId": "<id>" }`; repoint `current` to that revision. |

## Cleanup

Delete old revision records in PocketBase Admin UI; a delete hook removes the corresponding release directory (and blocks delete of the current revision).
To set up the PocketBase admin login, visit `https://site.example.com/_/` and create an admin user; use this Admin UI to delete revisions when needed.
