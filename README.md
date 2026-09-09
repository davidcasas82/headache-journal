# Leah's Migraine Journal

Phone-first web app Leah uses to log headache and migraine episodes. Entries live in the shared [`family-data`](../family-data) Cloudflare D1 API, behind a PIN.

**Intended live URL:** https://davidcasas82.github.io/headache-journal/

**Parent view (read-only, desktop-first):** https://davidcasas82.github.io/headache-journal/parent.html

The parent page unlocks with `PARENT_PIN` configured on [`family-data`](../family-data). It only lists entries (no create/edit/delete). Parent sessions use separate browser keys (`hj.parent.token`) so they do not collide with Leah's phone app.

This is a family doctor journal, not medical advice. Keep it off the public project hub.

## Local

In one terminal, start the API:

```bash
cd ../family-data
cp .dev.vars.example .dev.vars   # first time
npm install
npm run dev
```

Local PIN from `.dev.vars.example` is `2468`.

In another terminal, serve this folder:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080 for Leah's phone-first write app, or http://127.0.0.1:8080/parent.html for the parent dashboard. [`js/config.js`](js/config.js) already points localhost at `http://127.0.0.1:8787`.

On an iPhone: Safari → Share → **Add to Home Screen**.

## Publish

1. Create a public GitHub repo named `headache-journal` and push `main`.
2. Settings → Pages → Deploy from `main` / `/`.
3. Deploy [`family-data`](../family-data) and put the Worker URL in [`js/config.js`](js/config.js) (or set `window.FAMILY_DATA_URL` before the module loads).
4. Hide it on the hub with `"headache-journal": { "hidden": true }` in `davidcasas82.github.io/data/overrides.json`.

Never commit PINs. `FAMILY_PIN` (Leah) and `PARENT_PIN` (this parent view) live only on family-data. Only the API origin is public.
