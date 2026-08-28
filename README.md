# Leah's Migraine Journal

Phone-first web app Leah uses to log headache and migraine episodes. Entries live in the shared [`family-data`](../family-data) Cloudflare D1 API, behind a PIN.

**Intended live URL:** https://davidcasas82.github.io/headache-journal/

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

Open http://127.0.0.1:8080 — [`js/config.js`](js/config.js) already points localhost at `http://127.0.0.1:8787`.

On an iPhone: Safari → Share → **Add to Home Screen**.

## Publish

1. Create a public GitHub repo named `headache-journal` and push `main`.
2. Settings → Pages → Deploy from `main` / `/`.
3. Deploy [`family-data`](../family-data) and put the Worker URL in [`js/config.js`](js/config.js) (or set `window.FAMILY_DATA_URL` before the module loads).
4. Hide it on the hub with `"headache-journal": { "hidden": true }` in `davidcasas82.github.io/data/overrides.json`.

Never commit the PIN. Only the API origin is public.
