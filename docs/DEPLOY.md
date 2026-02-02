# Deploy topology (PocketBase + Nginx)

## Local run (no Docker)

From project root. PocketBase creates `pb_data` next to the executable (`pocketbase/pb_data`).

**Using the script (loads `.env` and sets deploy env):**

```bash
./scripts/start-pocketbase.sh
```

**Or manually:**

```bash
mkdir -p site/releases
export SITE_DEPLOY_TOKEN=your-token
export SITE_ROOT=$PWD/site
export SITE_URL=https://www.example.com
./pocketbase/pocketbase serve
```

Hooks load from `pocketbase/pb_hooks/` (next to the binary). The `revisions` collection is created automatically on startup; optional settings in Admin UI (`http://localhost:8090/_/`).

## Host paths (production)

- `/srv/pb/data` — PocketBase data (SQLite, `pb_data`). Create and chown so the PocketBase process can write.
- `/srv/site/releases` — revision directories (created by deploy).
- `/srv/site/current` — symlink to the active release (updated by deploy/rollback).

Nginx serves the site from `/srv/site/current`.

## Docker

1. Build the image (from project root). Pin PocketBase version with `--build-arg PB_VERSION=0.36.2`:
   ```bash
   docker build -t transformable-container .
   ```
2. Create host dirs and set ownership (e.g. your user or a dedicated user):
   ```bash
   sudo mkdir -p /srv/pb/data /srv/site/releases
   sudo chown -R $(id -u):$(id -g) /srv/pb /srv/site
   ```
3. Run the container with env and mounts (set `SITE_DEPLOY_TOKEN`; override `SITE_ROOT`/`SITE_URL` as needed). Use `--user $(id -u):$(id -g)` if the host dirs are owned by your user so the process can write:
   ```bash
   docker run -d --name pocketbase --restart unless-stopped \
     -p 127.0.0.1:8090:8090 \
     -v /srv/pb/data:/app/pb_data \
     -v /srv/site:/site \
     -e SITE_DEPLOY_TOKEN=your-token \
     -e SITE_ROOT=/site \
     -e SITE_URL=https://www.example.com \
     --user "$(id -u):$(id -g)" \
     transformable-container
   ```

The image sets default `SITE_ROOT=/site` and `SITE_URL=https://www.example.com`; override with `-e` at run. PocketBase listens on `127.0.0.1:8090` on the host so only Nginx (on the host) should proxy to it.

## Nginx (on host)

- **api.example.com** — proxy to PocketBase:
  ```nginx
  server {
    server_name api.example.com;
    location / {
      proxy_pass http://127.0.0.1:8090;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```

- **www.example.com** — serve static site from current release (SPA fallback):
  ```nginx
  server {
    server_name www.example.com;
    root /srv/site/current;
    index index.html;
    location / {
      try_files $uri $uri/ /index.html;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
    location = /index.html {
      expires -1;
      add_header Cache-Control "no-store";
    }
  }
  ```

Add TLS (e.g. Let’s Encrypt) and other options as needed.

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| SITE_DEPLOY_TOKEN | Yes | Bearer token for deploy/rollback/revisions. Set in `.env` or container env. |
| SITE_ROOT | No | Path to site root in container (releases + current). Default `/site`. |
| SITE_URL | No | Public URL of the site (e.g. `https://www.example.com`). Used in deploy response. |

For Cursor: put `PB_BASE_URL` and `SITE_DEPLOY_TOKEN` in `.env` or `.cursor.env`; see `skills.md`.
