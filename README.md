# transformable-container

PocketBase-backed deploy API for a single static site: deploy (zip upload), list revisions, rollback. An Nginx proxy can serve the active release from disk; PocketBase handles deploy/rollback and stores revision history.

**Skill for agents (e.g. Cursor):** The **Docker image** built from this repo is the deploy-API solution that an agent can use (deploy zip, list revisions, rollback). This **repo** can be used locally in Cursor so [skills.md](skills.md) and `.env` are ready to go when developing or testing; agents will build in `site-build/`, deploy with `./scripts/deploy.sh`.

## Build and run (Docker)

From the project root:

**1. Build the image**

```bash
docker build -t transformable-container .
```

To pin a PocketBase version: `docker build --build-arg PB_VERSION=0.36.2 -t transformable-container .`

**2. Create host dirs** (PocketBase data + site releases)

```bash
sudo mkdir -p /srv/pb/data /srv/site/releases
sudo chown -R "$(id -u):$(id -g)" /srv/pb /srv/site
```

**3. Run the container**

Set `SITE_DEPLOY_TOKEN` (required). Override `SITE_URL` if your site is not `https://www.example.com`.

```bash
docker run -d --name pocketbase --restart unless-stopped \
  -p 127.0.0.1:8090:8090 \
  -v /srv/pb/data:/app/pb_data \
  -v /srv/site:/site \
  -e SITE_DEPLOY_TOKEN=your-token \
  -e SITE_URL=https://www.example.com \
  --user "$(id -u):$(id -g)" \
  transformable-container
```

PocketBase is at `http://127.0.0.1:8090` (Admin UI: `http://127.0.0.1:8090/_/`). The `revisions` collection is created automatically on first start. For Nginx and env details see [docs/DEPLOY.md](docs/DEPLOY.md).

### Docker Compose

[docker-compose.yml](docker-compose.yml) runs the same app for production. It uses the same host dirs and env as the `docker run` example above.

**Setup:** Create host dirs and set `SITE_DEPLOY_TOKEN` in `.env` (see [.env.example](.env.example)). Optionally set `SITE_URL` and `DOCKER_IMAGE`.

```bash
sudo mkdir -p /srv/pb/data /srv/site/releases
sudo chown -R "$(id -u):$(id -g)" /srv/pb /srv/site
cp .env.example .env   # edit: SITE_DEPLOY_TOKEN required
```

**Run:**

- **Published image:** Set `DOCKER_IMAGE=yourusername/transformable-container:latest` in `.env`, then:
  ```bash
  docker compose pull && docker compose up -d
  ```
- **Local build (no published image):**
  ```bash
  docker compose up -d --build
  ```

Compose exposes port `8090` on the host. You can bind it to `127.0.0.1` by changing the ports entry in `docker-compose.yml` to `"127.0.0.1:8090:8090"` and put a reverse proxy (e.g. Nginx) in front; see below.

### Proxy (Nginx)

The **site directory** and **PocketBase port** are configured at the proxy (e.g. a self-hosted subdomain with SSL).

- **Site directory** — The container writes releases under the mounted site path (e.g. `/srv/site` → `/site`), and updates a `current` symlink to the active release. In Nginx, set `root` (or `alias`) to that path plus `current`, e.g. `root /srv/site/current`. You can use a different host path as long as the same path is mounted into the container and Nginx is pointed at it.
- **PocketBase port** — Bind PocketBase to `127.0.0.1:8090` (or another local port). In Nginx, use `proxy_pass` to that address for the API and Admin UI (e.g. `location /api`, `location /_/`). TLS and public hostnames are then handled by Nginx.

Example configs: [docs/DEPLOY.md](docs/DEPLOY.md#nginx-on-host).

## Quick start (non-Docker)

1. The `revisions` collection is created automatically on PocketBase start (see [docs/SCHEMA.md](docs/SCHEMA.md)).
2. Set `SITE_DEPLOY_TOKEN` (and optionally `SITE_ROOT`, `SITE_URL`). Use [.env.example](.env.example) as a template; copy to `.env` or `.cursor.env` and never commit secrets.
3. Run PocketBase locally: [docs/DEPLOY.md](docs/DEPLOY.md#local-run-no-docker).
4. Deploy: build in `site-build/`, zip to `site-build/site.zip`, then run `./scripts/deploy.sh` (or `POST /api/site/deploy` with the zip and Bearer token). See [skills.md](skills.md) for API details (placeholders; substitute from env at runtime).

## Repo layout

- **pocketbase/** — PocketBase binary and [pb_hooks](pocketbase/pb_hooks/) (deploy, rollback, revisions, delete hook).
- **docs/** — [SCHEMA.md](docs/SCHEMA.md) (revisions collection + singleton), [DEPLOY.md](docs/DEPLOY.md) (host paths, Docker, Nginx), [DOCKER_HUB.md](docs/DOCKER_HUB.md) (push image to Docker Hub).
- **skills.md** — API map for Cursor (placeholders `{{PB_BASE_URL}}`, `{{SITE_DEPLOY_TOKEN}}`).
- **docker-compose.yml** — Production compose: use published image (set `DOCKER_IMAGE` in `.env`) or build locally; see comments in file.
- **Dockerfile** — Downloads the PocketBase Linux binary for the build arch and copies `pb_hooks`. Default env: `SITE_ROOT=/site`, `SITE_URL=...`. Run with `-v /srv/pb/data:/app/pb_data -v /srv/site:/site` and `-e SITE_DEPLOY_TOKEN=...`; see [docs/DEPLOY.md](docs/DEPLOY.md).

## API (3 routes)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/site/deploy | Bearer token | Upload zip (multipart `file`, optional `message`); extract, flip `current`, return `currentRevisionId`, `url`, `message`. |
| GET | /api/site/revisions?limit=20 | Bearer token | List current revision id and recent revisions. |
| POST | /api/site/rollback | Bearer token | Body `{ "revisionId": "<id>" }`; repoint `current` to that revision. |

Cleanup: delete old revision records in PocketBase Admin UI; a delete hook removes the corresponding release directory (and blocks delete of the current revision).
