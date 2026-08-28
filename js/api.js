import { apiBase } from "./config.js";

const TOKEN_KEY = "hj.token";
const KEEP_KEY = "hj.keep";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
}

export function setSession(token, keepUnlocked) {
  clearSession();
  const store = keepUnlocked ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  localStorage.setItem(KEEP_KEY, keepUnlocked ? "1" : "0");
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function unlock(pin, keepUnlocked) {
  const res = await request("/auth/unlock", {
    method: "POST",
    body: { pin, keepUnlocked },
    auth: false,
  });
  setSession(res.token, keepUnlocked);
  return res;
}

export function listEntries() {
  return request("/v1/headache-journal/entries");
}

export function createEntry(entry) {
  return request("/v1/headache-journal/entries", { method: "POST", body: entry });
}

export function updateEntry(id, entry) {
  return request(`/v1/headache-journal/entries/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: entry,
  });
}

export function deleteEntry(id) {
  return request(`/v1/headache-journal/entries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (!token) {
      const err = new Error("Open your journal with your PIN first.");
      err.status = 401;
      throw err;
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const err = new Error("Can't reach your journal right now. Try again in a minute.");
    err.status = 0;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearSession();
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
