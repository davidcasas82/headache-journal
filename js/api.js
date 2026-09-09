import { apiBase } from "./config.js";

const DEFAULT_KEYS = { token: "hj.token", keep: "hj.keep" };
export const PARENT_KEYS = { token: "hj.parent.token", keep: "hj.parent.keep" };

export function createApi(keys = DEFAULT_KEYS) {
  const TOKEN_KEY = keys.token;
  const KEEP_KEY = keys.keep;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(token, keepUnlocked) {
    clearSession();
    const store = keepUnlocked ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    localStorage.setItem(KEEP_KEY, keepUnlocked ? "1" : "0");
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  async function unlock(pin, keepUnlocked) {
    const res = await request("/auth/unlock", {
      method: "POST",
      body: { pin, keepUnlocked },
      auth: false,
    });
    setSession(res.token, keepUnlocked);
    return res;
  }

  function listEntries() {
    return request("/v1/headache-journal/entries");
  }

  function createEntry(entry) {
    return request("/v1/headache-journal/entries", { method: "POST", body: entry });
  }

  function updateEntry(id, entry) {
    return request(`/v1/headache-journal/entries/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: entry,
    });
  }

  function deleteEntry(id) {
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

  return {
    getToken,
    setSession,
    clearSession,
    unlock,
    listEntries,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

const defaultApi = createApi(DEFAULT_KEYS);

export const getToken = defaultApi.getToken;
export const setSession = defaultApi.setSession;
export const clearSession = defaultApi.clearSession;
export const unlock = defaultApi.unlock;
export const listEntries = defaultApi.listEntries;
export const createEntry = defaultApi.createEntry;
export const updateEntry = defaultApi.updateEntry;
export const deleteEntry = defaultApi.deleteEntry;

export const parentApi = createApi(PARENT_KEYS);
