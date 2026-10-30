import { clearSynced, installSync, isSynced, pull, push, setSyncSession } from "./sync";

// a tiny stand-in for the API's /api/data
let server: Map<string, { value: string | null; updated: number }>;
let clock: number;
let posts: string[][];

beforeAll(() => installSync());

beforeEach(() => {
  localStorage.clear();
  server = new Map();
  clock = 1000;
  posts = [];
  setSyncSession("session-a");
  (global as any).fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const now = ++clock;
    if (init?.method === "POST") {
      const { items } = JSON.parse(String(init.body));
      posts.push(items.map((i: { key: string }) => i.key));
      for (const { key, value } of items) server.set(key, { value, updated: now });
      return { ok: true, json: async () => ({ ok: true, now }) };
    }
    const since = Number(new URL(url, "http://x").searchParams.get("since"));
    const items = Array.from(server.entries())
      .filter(([, v]) => v.updated > since)
      .map(([key, v]) => ({ key, value: v.value, updated: v.updated }));
    return { ok: true, json: async () => ({ now, items }) };
  });
});

afterEach(() => setSyncSession(null));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it("only syncs saved work, not caches or flags", () => {
  expect(isSynced("selectedCourses_fall_26")).toBe(true);
  expect(isSynced("plannerPlan")).toBe(true);
  expect(isSynced("friendSchedules")).toBe(true);
  expect(isSynced("prereqInfo:26_fall")).toBe(false);
  expect(isSynced("graphData")).toBe(false);
  expect(isSynced("ufsSession")).toBe(false);
});

it("on first sign-in the account wins where both have data and local-only data is added", async () => {
  server.set("plannerPlan", { value: "account plan", updated: 5 });
  localStorage.setItem("plannerPlan", "device plan");
  localStorage.setItem("friendSchedules", "device friends");
  localStorage.setItem("graphData", "cache");

  expect(await pull()).toBe(true);
  await flush();
  expect(localStorage.getItem("plannerPlan")).toBe("account plan");
  expect(server.get("friendSchedules")?.value).toBe("device friends");
  expect(server.has("graphData")).toBe(false);
});

it("pushes edits made while signed in, and skips writes that change nothing", async () => {
  await pull();
  jest.useFakeTimers();
  try {
    localStorage.setItem("selectedCourses_fall_26", "[1]");
    localStorage.setItem("selectedCourses_fall_26", "[1]");
    localStorage.setItem("hasClosedChat", "true");
    jest.advanceTimersByTime(2000);
  } finally {
    jest.useRealTimers();
  }
  await flush();
  await flush();
  expect(posts).toEqual([["selectedCourses_fall_26"]]);
  expect(server.get("selectedCourses_fall_26")?.value).toBe("[1]");
});

it("keeps unsent local edits over older server values", async () => {
  await pull();
  // pretend the push failed, then another device wrote the same key
  (global as any).fetch.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }));
  localStorage.setItem("plannerNow", "fall 26");
  await push();
  server.set("plannerNow", { value: "spring 27", updated: ++clock });

  await pull();
  await flush();
  expect(localStorage.getItem("plannerNow")).toBe("fall 26");
  expect(server.get("plannerNow")?.value).toBe("fall 26");
});

it("brings in another device's changes and deletions", async () => {
  localStorage.setItem("shareName", "Al");
  await pull();
  await flush();
  server.set("shareName", { value: "Albert", updated: ++clock });
  server.set("customAppointments_fall_26", { value: null, updated: ++clock });
  localStorage.setItem("customAppointments_fall_26", "[]");
  // that local write was tracked; pretend it was sent before the delete
  await push();
  server.set("customAppointments_fall_26", { value: null, updated: ++clock });

  expect(await pull()).toBe(true);
  expect(localStorage.getItem("shareName")).toBe("Albert");
  expect(localStorage.getItem("customAppointments_fall_26")).toBeNull();
});

it("signing out clears the account's data from the device", () => {
  localStorage.setItem("plannerPlan", "x");
  localStorage.setItem("hasClosedChat", "true");
  clearSynced();
  expect(localStorage.getItem("plannerPlan")).toBeNull();
  expect(localStorage.getItem("hasClosedChat")).toBe("true");
});
