# Deploy topology (PocketBase + Nginx)

## Nginx (on host)

- **site.example.com** — serve the static site and proxy the API/Admin UI to PocketBase:
  ```nginx
  server {
    server_name site.example.com;
    root /home/forge/site.example.com/current;
    index index.html;

    location /api/ {
      proxy_pass http://127.0.0.1:8090;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_/ {
      proxy_pass http://127.0.0.1:8090;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

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

For Cursor: put `PB_BASE_URL` and `SITE_DEPLOY_TOKEN` in `.env` or `.cursor.env`; see `skills.md`. If PocketBase is proxied on the same domain (e.g. `https://site.example.com/api`), `PB_BASE_URL` can match `SITE_URL`.
