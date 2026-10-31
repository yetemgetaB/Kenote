import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { api } = await import("../src/utils/tauriBridge.ts");

describe("In-Place Editing & External Notes Tests", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("opens an external file and marks it as is_external", async () => {
    const fakePath = "C:/Users/Test/Documents/project_notes.md";
    const note = await api.openExternalNote(fakePath);

    assert.equal(note.id, fakePath);
    assert.equal(note.filename, fakePath);
    assert.equal(note.file_path, fakePath);
    assert.equal(note.is_external, true);
    assert.equal(note.title, "project_notes");

    const allNotes = await api.listNotes();
    const found = allNotes.find((n) => n.id === fakePath);
    assert.ok(found, "External note should be present in listed notes");
    assert.equal(found.is_external, true);
  });

  it("updates and saves external notes in-place", async () => {
    const fakePath = "/home/developer/workspace/README.md";
    await api.openExternalNote(fakePath);

    const updated = await api.saveNote(fakePath, "# New Project Docs\n\nSome body text", true);
    assert.equal(updated.id, fakePath);
    assert.equal(updated.title, "New Project Docs");
    assert.equal(updated.is_pinned, true);
    assert.equal(updated.is_external, true);
    assert.equal(updated.file_path, fakePath);

    const allNotes = await api.listNotes();
    const found = allNotes.find((n) => n.id === fakePath);
    assert.ok(found);
    assert.equal(found.content, "# New Project Docs\n\nSome body text");
  });

  it("untracks an external note without moving it to trash", async () => {
    const fakePath = "D:/Notes/Meeting.txt";
    await api.openExternalNote(fakePath);

    let allNotes = await api.listNotes();
    assert.ok(allNotes.some((n) => n.id === fakePath));

    await api.untrackExternalNote(fakePath);

    allNotes = await api.listNotes();
    assert.ok(!allNotes.some((n) => n.id === fakePath), "Note should be removed from active notes");

    const trashed = await api.listTrashedNotes();
    assert.ok(!trashed.some((n) => n.id === fakePath), "Untracked note must NOT be in trash");
  });

  it("calling deleteNote on an external note does not move it to trash", async () => {
    const fakePath = "C:/Work/Confidential.md";
    await api.openExternalNote(fakePath);

    await api.deleteNote(fakePath);

    const allNotes = await api.listNotes();
    assert.ok(!allNotes.some((n) => n.id === fakePath));

    const trashed = await api.listTrashedNotes();
    assert.ok(!trashed.some((n) => n.id === fakePath), "External note should never be placed in trash");
  });

  it("handles launch file retrieval gracefully when not in desktop", async () => {
    const launchFile = await api.getLaunchFile();
    assert.equal(launchFile, null);
  });

  it("handles external file open event listener registration gracefully", async () => {
    let received = null;
    const cleanup = await api.onOpenExternalFile((file) => {
      received = file;
    });
    assert.equal(typeof cleanup, "function");
    cleanup();
  });
});
