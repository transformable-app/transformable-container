# Site deploy API (Cursor)

Use these placeholders when making requests. Substitute from environment at execution time; never print secret values.

- **Base:** `{{PB_BASE_URL}}`
- **Auth:** `Authorization: Bearer {{SITE_DEPLOY_TOKEN}}`

## Deploy

- **POST** `{{PB_BASE_URL}}/api/site/deploy`
- **Body:** `multipart/form-data`
  - `file` = zip of built site (e.g. contents of `dist/`)
  - `message` (optional) = short note

## Revisions (history)

- **GET** `{{PB_BASE_URL}}/api/site/revisions?limit=20`

## Rollback

- **POST** `{{PB_BASE_URL}}/api/site/rollback`
- **Body:** JSON `{ "revisionId": "<id>" }`

## Cleanup

- No DELETE endpoint. Remove old revisions via PocketBase Admin UI (delete record); a delete hook will remove the release directory on disk. Do not delete the current revision.
