import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/utils/tauriBridge.ts";

describe("Autostart Unit Tests", () => {
  beforeEach(() => {
    // Reset browser mock localStorage
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.clear();
    } else {
      const store = new Map();
      globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
      };
    }
  });

  it("defaults autostart to disabled in mock environment", async () => {
    const isEnabled = await api.isAutostartEnabled();
    assert.equal(isEnabled, false);
  });

  it("enables and disables autostart via bridge API", async () => {
    const enabledState = await api.setAutostartEnabled(true);
    assert.equal(enabledState, true);
    assert.equal(await api.isAutostartEnabled(), true);

    const disabledState = await api.setAutostartEnabled(false);
    assert.equal(disabledState, false);
    assert.equal(await api.isAutostartEnabled(), false);
  });

  it("correctly identifies autostart CLI launch arguments", () => {
    const isAutostartArg = (args) =>
      args.some((a) => a === "--autostart" || a === "--silent" || a === "--hidden");

    assert.equal(isAutostartArg(["kenote.exe", "--autostart"]), true);
    assert.equal(isAutostartArg(["kenote.exe", "--silent"]), true);
    assert.equal(isAutostartArg(["kenote.exe", "--hidden"]), true);
    assert.equal(isAutostartArg(["kenote.exe", "--flag", "--autostart"]), true);
    assert.equal(isAutostartArg(["kenote.exe"]), false);
    assert.equal(isAutostartArg(["kenote.exe", "--normal"]), false);
    assert.equal(isAutostartArg([]), false);
  });
});
