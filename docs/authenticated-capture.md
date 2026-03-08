# Authenticated capture

`capture-authenticated-route.mjs` is the generic screenshot companion tool for UI review workflows.

It supports three patterns:
- interactive login via labels/buttons
- optional bootstrap request before login
- optional seed script before navigation

## Dry-run example

```bash
node scripts/capture-authenticated-route.mjs \
  --baseUrl http://127.0.0.1:3000 \
  --route /dashboard \
  --output tmp/dashboard.png \
  --dryRun
```

## Login example

```bash
node scripts/capture-authenticated-route.mjs \
  --baseUrl http://127.0.0.1:3000 \
  --route /courses/demo-101 \
  --output tmp/course-home.png \
  --email reviewer@local.test \
  --password secret123 \
  --loginPath /login \
  --submitLabel "Sign in" \
  --postLoginUrl "/courses"
```

## Bootstrap request example

Use a JSON file or inline JSON with placeholders:

```json
{
  "token": "{{adminToken}}",
  "user": {
    "email": "{{email}}",
    "password": "{{password}}"
  }
}
```

Then call:

```bash
node scripts/capture-authenticated-route.mjs \
  --baseUrl http://127.0.0.1:3000 \
  --route /courses/demo-101 \
  --output tmp/course-home.png \
  --bootstrapUrl /api/admin/user/apply \
  --bootstrapBody examples/synthetic-pack/bootstrap-user.json \
  --email reviewer@local.test \
  --password secret123
```

## Notes

- `--dryRun` prints the resolved plan without launching Playwright.
- `--storageState` can skip the login flow when you already have a saved browser session.
- Keep real screenshots and real session state out of this repo.
