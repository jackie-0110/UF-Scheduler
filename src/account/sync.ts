import { API_BASE_URL } from "../config/api";

// Keeps the app's saved state in the signed-in account. Every component
// already saves to localStorage, so this watches writes to the keys below and
// mirrors them to the API instead of touching each component.

const SYNCED = [
  /^selectedCourses_/,
  /^customAppointments_/,
  /^selectedCalendar_/,
  /^planner(Plan|Now|Major)$/,
  /^completed(Courses|Grades|Credits)$/,
  /^friendSchedules$/,
  /^shareName$/,
  /^selectedMajor(Plan)?$/,
  /^selectedTerm(Value)?$/,
  /^selectedYear$/,
];
export const isSynced = (key: string) => SYNCED.some((pattern) => pattern.test(key));

const META = "accountSync";
// owner is the session the dirty list belongs to; lastPull is server time
type Meta = { owner: string; lastPull: number; dirty: string[] };

const store = window.localStorage;
const rawSet = Storage.prototype.setItem;
const rawRemove = Storage.prototype.removeItem;
const rawGet = (key: string) => Storage.prototype.getItem.call(store, key);

const readMeta = (): Meta | null => {
  try {
    return JSON.parse(rawGet(META) ?? "null");
  } catch {
    return null;
  }
};
const writeMeta = (meta: Meta | null) =>
  meta ? rawSet.call(store, META, JSON.stringify(meta)) : rawRemove.call(store, META);

let session: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;

const markDirty = (key: string) => {
  const meta = readMeta();
  // only track edits made while signed in; the first sync handles the rest
  if (!session || !meta || meta.owner !== session) return;
  if (!meta.dirty.includes(key)) {
    meta.dirty.push(key);
    writeMeta(meta);
  }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
};

let installed = false;
export const installSync = () => {
  if (installed) return;
  installed = true;
  Storage.prototype.setItem = function (key: string, value: string) {
    const changed = this === store && isSynced(key) && rawGet(key) !== String(value);
    rawSet.call(this, key, value);
    if (changed) markDirty(key);
  };
  Storage.prototype.removeItem = function (key: string) {
    const changed = this === store && isSynced(key) && rawGet(key) !== null;
    rawRemove.call(this, key);
    if (changed) markDirty(key);
  };
};

const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session}` });

// Requests stay well under the API's body limit
const chunks = (items: { key: string; value: string | null }[]) => {
  const out: (typeof items)[] = [];
  let current: typeof items = [];
  let size = 0;
  for (const item of items) {
    const length = (item.value?.length ?? 0) + item.key.length + 32;
    if (current.length && (size + length > 2_500_000 || current.length >= 50)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += length;
  }
  if (current.length) out.push(current);
  return out;
};

export async function push() {
  const meta = readMeta();
  if (!session || pushing || !meta || meta.owner !== session || !meta.dirty.length) return;
  pushing = true;
  try {
    const items = meta.dirty.map((key) => ({ key, value: rawGet(key) }));
    for (const batch of chunks(items)) {
      const r = await fetch(`${API_BASE_URL}/api/data`, { method: "POST", headers: headers(), body: JSON.stringify({ items: batch }) });
      if (!r.ok) throw new Error(`sync ${r.status}`);
    }
    // anything edited while the request was out stays dirty
    const latest = readMeta();
    if (latest && latest.owner === session) {
      latest.dirty = latest.dirty.filter((key) => {
        const sent = items.find((i) => i.key === key);
        return !sent || sent.value !== rawGet(key);
      });
      writeMeta(latest);
    }
  } catch {
    // offline or the API is down; the dirty list keeps it for next time
  } finally {
    pushing = false;
  }
  if (readMeta()?.dirty.length) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 15_000);
  }
}

/**
 * Pulls what other devices saved. On the first sync for a session the account
 * wins where both have something, and anything only on this device is added.
 * Returns true when local data changed, so the caller can refresh the page.
 */
export async function pull(signal?: AbortSignal): Promise<boolean> {
  if (!session) return false;
  let meta = readMeta();
  const first = !meta || meta.owner !== session;
  if (first) meta = { owner: session, lastPull: 0, dirty: [] };
  // overlap a minute so a write that landed mid-request isn't skipped
  const since = first ? 0 : Math.max(0, meta!.lastPull - 60_000);
  const r = await fetch(`${API_BASE_URL}/api/data?since=${since}`, { headers: headers(), signal });
  if (!r.ok) return false;
  const data: { now: number; items: { key: string; value: string | null }[] } = await r.json();
  if (signal?.aborted) return false;

  let changed = false;
  const dirty = new Set(meta!.dirty);
  const fromServer = new Set<string>();
  for (const { key, value } of data.items) {
    if (!isSynced(key)) continue;
    fromServer.add(key);
    // unsent edits here are newer than what the server has
    if (dirty.has(key)) continue;
    if (rawGet(key) === value) continue;
    if (value === null) rawRemove.call(store, key);
    else rawSet.call(store, key, value);
    changed = true;
  }
  if (first) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && isSynced(key) && !fromServer.has(key)) dirty.add(key);
    }
  }
  writeMeta({ owner: session, lastPull: data.now, dirty: Array.from(dirty) });
  if (dirty.size) push();
  return changed;
}

export const setSyncSession = (value: string | null) => {
  session = value;
};

/** Signing out takes the account's data off this device; it comes back on sign-in. */
export const clearSynced = () => {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && isSynced(key)) keys.push(key);
  }
  keys.forEach((key) => rawRemove.call(store, key));
  writeMeta(null);
};

// Before the app first renders: wait a little for the account's data, but
// give up (and apply nothing) rather than hold the page
export const pullWithin = async (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await pull(controller.signal);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
