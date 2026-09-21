import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

describe("S3 Navigation & Window State Tests", () => {
  let dom;
  let window;
  let localStorage;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost:1420",
    });
    window = dom.window;
    localStorage = window.localStorage;
  });

  describe("MRU Note Ordering", () => {
    const mockNotes = [
      { id: "note_pinned_1", filename: "note_pinned_1.md", title: "Pinned 1", content: "A", is_pinned: true, updated_at: 100 },
      { id: "note_pinned_2", filename: "note_pinned_2.md", title: "Pinned 2", content: "B", is_pinned: true, updated_at: 90 },
      { id: "note_normal_1", filename: "note_normal_1.md", title: "Normal 1", content: "C", is_pinned: false, updated_at: 80 },
      { id: "note_normal_2", filename: "note_normal_2.md", title: "Normal 2", content: "D", is_pinned: false, updated_at: 70 },
    ];

    function getOrderedNotes(notes, recentNoteIds, orderMode = "mru") {
      if (orderMode === "pinned_updated") {
        return notes;
      }
      const mruNotes = [];
      const notesMap = new Map(notes.map((n) => [n.id, n]));

      for (const id of recentNoteIds) {
        const note = notesMap.get(id);
        if (note) {
          mruNotes.push(note);
          notesMap.delete(id);
        }
      }
      const unvisited = Array.from(notesMap.values()).sort((a, b) => b.updated_at - a.updated_at);
      for (const remaining of unvisited) {
        mruNotes.push(remaining);
      }
      return mruNotes;
    }

    it("seeds MRU with startup active note and respects user navigation order", () => {
      let recentNoteIds = ["note_normal_1"];
      let ordered = getOrderedNotes(mockNotes, recentNoteIds);

      assert.equal(ordered[0].id, "note_normal_1");

      recentNoteIds = ["note_normal_2", ...recentNoteIds.filter((id) => id !== "note_normal_2")];
      ordered = getOrderedNotes(mockNotes, recentNoteIds);

      assert.equal(ordered[0].id, "note_normal_2");
      assert.equal(ordered[1].id, "note_normal_1");
    });

    it("pinned notes do not override MRU history", () => {
      const recentNoteIds = ["note_normal_2", "note_normal_1"];
      const ordered = getOrderedNotes(mockNotes, recentNoteIds);

      assert.equal(ordered[0].id, "note_normal_2");
      assert.equal(ordered[1].id, "note_normal_1");
      assert.equal(ordered[2].id, "note_pinned_1");
      assert.equal(ordered[3].id, "note_pinned_2");
    });

    it("unvisited notes are ordered by recency, not by pinned state", () => {
      const customNotes = [
        { id: "note_pinned_old", is_pinned: true, updated_at: 100 },
        { id: "note_unpinned_recent", is_pinned: false, updated_at: 500 },
        { id: "note_active", is_pinned: false, updated_at: 200 },
      ];
      const recentNoteIds = ["note_active"];
      const ordered = getOrderedNotes(customNotes, recentNoteIds);

      assert.equal(ordered[0].id, "note_active");
      assert.equal(ordered[1].id, "note_unpinned_recent"); // recency (500) beats pinned (100)
      assert.equal(ordered[2].id, "note_pinned_old");
    });

    it("prevents duplicate entries in MRU and prunes deleted notes", () => {
      let recentNoteIds = ["note_normal_1"];
      
      recentNoteIds = ["note_normal_2", ...recentNoteIds.filter((id) => id !== "note_normal_2")];
      recentNoteIds = ["note_normal_1", ...recentNoteIds.filter((id) => id !== "note_normal_1")];
      
      assert.deepEqual(recentNoteIds, ["note_normal_1", "note_normal_2"]);

      recentNoteIds = recentNoteIds.filter((id) => id !== "note_normal_2");
      assert.deepEqual(recentNoteIds, ["note_normal_1"]);
    });

    it("simulates rapid Ctrl+Tab transitions without stale indexing", () => {
      let currentId = "note_normal_1";
      let recentNoteIds = ["note_normal_1", "note_normal_2", "note_pinned_1"];

      let ordered = getOrderedNotes(mockNotes, recentNoteIds);
      let curIdx = ordered.findIndex((n) => n.id === currentId);
      let nextIdx = (curIdx + 1) % ordered.length;
      let targetNote = ordered[nextIdx];
      assert.equal(targetNote.id, "note_normal_2");

      currentId = targetNote.id;
      recentNoteIds = [currentId, ...recentNoteIds.filter((id) => id !== currentId)];

      ordered = getOrderedNotes(mockNotes, recentNoteIds);
      curIdx = ordered.findIndex((n) => n.id === currentId);
      nextIdx = (curIdx + 1) % ordered.length;
      targetNote = ordered[nextIdx];
      assert.equal(targetNote.id, "note_normal_1");
    });
  });

  describe("Per-Note Cursor Persistence & Clamping", () => {
    const CURSOR_STORAGE_KEY = "kenote_cursor_positions";

    function saveCursor(noteId, from, to) {
      const current = JSON.parse(localStorage.getItem(CURSOR_STORAGE_KEY) || "{}");
      current[noteId] = { from, to };
      localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(current));
    }

    function getRestoredCursor(noteId, docSize) {
      const savedMap = JSON.parse(localStorage.getItem(CURSOR_STORAGE_KEY) || "{}");
      const savedPos = savedMap[noteId];
      if (!savedPos || typeof savedPos.from !== "number") {
        return null;
      }
      const from = Math.min(Math.max(1, savedPos.from), docSize);
      const to = Math.min(Math.max(from, savedPos.to ?? from), docSize);
      return { from, to };
    }

    it("persists and restores separate cursor locations for different notes", () => {
      saveCursor("note_alpha", 150, 150);
      saveCursor("note_beta", 42, 42);
      saveCursor("note_gamma", 900, 950);

      const alphaCursor = getRestoredCursor("note_alpha", 200);
      const betaCursor = getRestoredCursor("note_beta", 100);
      const gammaCursor = getRestoredCursor("note_gamma", 1000);

      assert.deepEqual(alphaCursor, { from: 150, to: 150 });
      assert.deepEqual(betaCursor, { from: 42, to: 42 });
      assert.deepEqual(gammaCursor, { from: 900, to: 950 });
    });

    it("safely clamps cursor when document was shortened externally or edited", () => {
      saveCursor("note_shortened", 500, 500);

      const clamped = getRestoredCursor("note_shortened", 120);
      assert.deepEqual(clamped, { from: 120, to: 120 });
    });

    it("handles empty note doc size (minimum position 1)", () => {
      saveCursor("note_empty", 0, 0);

      const restored = getRestoredCursor("note_empty", 1);
      assert.deepEqual(restored, { from: 1, to: 1 });
    });

    it("deleting a note cleans up its cursor entry", () => {
      saveCursor("note_to_delete", 85, 85);
      assert.ok(getRestoredCursor("note_to_delete", 100));

      const current = JSON.parse(localStorage.getItem(CURSOR_STORAGE_KEY) || "{}");
      delete current["note_to_delete"];
      localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(current));

      assert.equal(getRestoredCursor("note_to_delete", 100), null);
    });
  });

  describe("Window State & Settings Merging", () => {
    function mergeSettings(existing, incoming) {
      const merged = { ...incoming };
      if (merged.window_x === undefined || merged.window_x === null) {
        merged.window_x = existing.window_x;
      }
      if (merged.window_y === undefined || merged.window_y === null) {
        merged.window_y = existing.window_y;
      }
      if (merged.window_width === undefined || merged.window_width === null) {
        merged.window_width = existing.window_width;
      }
      if (merged.window_height === undefined || merged.window_height === null) {
        merged.window_height = existing.window_height;
      }
      return merged;
    }

    it("preserves saved window coordinates when frontend updates note settings", () => {
      const savedOnDisk = {
        accent_color: "#0399F7",
        window_x: 640,
        window_y: 320,
        window_width: 520,
        window_height: 720,
        last_active_note_id: "note_1",
      };

      const frontendSave = {
        accent_color: "#FF5500",
        last_active_note_id: "note_2",
      };

      const result = mergeSettings(savedOnDisk, frontendSave);
      assert.equal(result.accent_color, "#FF5500");
      assert.equal(result.last_active_note_id, "note_2");
      assert.equal(result.window_x, 640);
      assert.equal(result.window_y, 320);
      assert.equal(result.window_width, 520);
      assert.equal(result.window_height, 720);
    });

    it("validates monitor bounds and identifies off-screen coordinates", () => {
      const monitors = [
        { x: 0, y: 0, width: 1920, height: 1080 },
        { x: 1920, y: 0, width: 1920, height: 1080 },
      ];

      function isCoordinateOnMonitors(x, y, displayList) {
        return displayList.some(
          (m) =>
            x >= m.x - 100 &&
            x < m.x + m.width &&
            y >= m.y - 50 &&
            y < m.y + m.height
        );
      }

      assert.equal(isCoordinateOnMonitors(500, 300, monitors), true);
      assert.equal(isCoordinateOnMonitors(2400, 400, monitors), true);
      assert.equal(isCoordinateOnMonitors(4000, 500, monitors), false);
      assert.equal(isCoordinateOnMonitors(-32000, -32000, monitors), false);
    });
  });

  describe("Last Active Note Fallback", () => {
    it("falls back safely when saved last active note does not exist", () => {
      const availableNotes = [
        { id: "note_welcome", title: "Welcome", content: "Hi" },
        { id: "note_project", title: "Project", content: "Work" },
      ];
      const savedLastId = "note_deleted_previously";

      let targetNote = availableNotes.find((n) => n.id === savedLastId);
      if (!targetNote) {
        targetNote = availableNotes[0];
      }

      assert.equal(targetNote.id, "note_welcome");
    });
  });
});
