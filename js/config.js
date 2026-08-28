// After you deploy family-data, set the Worker origin here (or window.FAMILY_DATA_URL).
const PRODUCTION_API = "https://family-data.workers.dev";

export function apiBase() {
  const override = window.FAMILY_DATA_URL;
  if (typeof override === "string" && override.trim()) {
    return override.replace(/\/+$/, "");
  }

  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://127.0.0.1:8787";
  }

  return PRODUCTION_API;
}
