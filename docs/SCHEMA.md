# PocketBase schema for site deploy

The **revisions** collection is created automatically on PocketBase startup (see `pb_hooks/main.pb.js` onBootstrap). You can also create or adjust it in Admin UI.

## Collection: `revisions`

| Field     | Type   | Notes |
|-----------|--------|--------|
| id       | (default) | Auto |
| created  | (default) | Auto (PocketBase default date field) |
| updated  | (default) | Auto |
| createdBy | (optional) | Optional; link to users if you use auth |
| message   | text   | Optional; deploy message |
| status    | select | Values: `uploaded`, `staged`, `active` |
| hash      | text   | Optional; checksum of zip |
| path      | text   | Path to extracted dir, e.g. `releases/<id>/` |

**API rules**

- **List / View:** allow for deploy-token requests or admin (custom routes use deploy token; standard list/view can be denied for API and allowed only for admin if you prefer).
- **Create:** deny for API (only the deploy hook creates records).
- **Update:** allow admin only (or deny all; hook updates via backend).
- **Delete:** allow admin only (Admin UI). Deny for all non-admin so the deploy token cannot delete. Integrity checks are disabled for this collection on bootstrap so revision records can be deleted from the Admin UI even if another collection has a relation pointing to them; the `onRecordDelete` hook still cleans up the release directory and blocks deletion of the current revision.

## Current revision pointer (singleton)

The hooks read/write `currentRevisionId` in a JSON file under the PocketBase data directory:

- **Path:** `{pb_data}/site_current.json`
- **Content:** `{ "currentRevisionId": "<revision_id_or_empty>" }`

No collection needed; the file is created and updated by the deploy/rollback hooks. Ensure the PocketBase process can write to `pb_data`.
