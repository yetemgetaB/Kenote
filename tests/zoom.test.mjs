import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_GLOBAL_ZOOM,
  MAX_GLOBAL_ZOOM,
  DEFAULT_GLOBAL_ZOOM,
  STEP_GLOBAL_ZOOM,
  MIN_EDITOR_ZOOM,
  MAX_EDITOR_ZOOM,
  DEFAULT_EDITOR_ZOOM,
  STEP_EDITOR_ZOOM,
  clampGlobalZoom,
  clampEditorZoom,
  incrementGlobalZoom,
  decrementGlobalZoom,
  incrementEditorZoom,
  decrementEditorZoom,
  applyGlobalZoom,
} from "../src/utils/zoom.ts";
import { DEFAULT_SETTINGS } from "../src/types/note.ts";

describe("Global & Editor Zoom Unit Tests", () => {
  describe("1. Default Zoom Values & Constants", () => {
    it("has expected default values and boundaries", () => {
      assert.equal(DEFAULT_GLOBAL_ZOOM, 100);
      assert.equal(MIN_GLOBAL_ZOOM, 70);
      assert.equal(MAX_GLOBAL_ZOOM, 150);
      assert.equal(STEP_GLOBAL_ZOOM, 10);

      assert.equal(DEFAULT_EDITOR_ZOOM, 100);
      assert.equal(MIN_EDITOR_ZOOM, 70);
      assert.equal(MAX_EDITOR_ZOOM, 200);
      assert.equal(STEP_EDITOR_ZOOM, 10);
    });

    it("DEFAULT_SETTINGS includes global_zoom, editor_zoom, and global_shortcut", () => {
      assert.equal(DEFAULT_SETTINGS.global_zoom, 100);
      assert.equal(DEFAULT_SETTINGS.editor_zoom, 100);
      assert.equal(DEFAULT_SETTINGS.global_shortcut, "Alt+Shift+K");
    });
  });

  describe("2. Clamping Logic & Safety", () => {
    it("clamps global zoom correctly within [70, 150]", () => {
      assert.equal(clampGlobalZoom(100), 100);
      assert.equal(clampGlobalZoom(50), 70);
      assert.equal(clampGlobalZoom(69), 70);
      assert.equal(clampGlobalZoom(150), 150);
      assert.equal(clampGlobalZoom(180), 150);
      assert.equal(clampGlobalZoom(95.4), 95);
    });

    it("falls back to default global zoom on invalid/missing input", () => {
      assert.equal(clampGlobalZoom(undefined), 100);
      assert.equal(clampGlobalZoom(null), 100);
      assert.equal(clampGlobalZoom(NaN), 100);
      assert.equal(clampGlobalZoom("100"), 100);
    });

    it("clamps editor zoom correctly within [70, 200]", () => {
      assert.equal(clampEditorZoom(100), 100);
      assert.equal(clampEditorZoom(40), 70);
      assert.equal(clampEditorZoom(200), 200);
      assert.equal(clampEditorZoom(250), 200);
      assert.equal(clampEditorZoom(125.2), 125);
    });

    it("falls back to default editor zoom on invalid/missing input", () => {
      assert.equal(clampEditorZoom(undefined), 100);
      assert.equal(clampEditorZoom(null), 100);
      assert.equal(clampEditorZoom(NaN), 100);
      assert.equal(clampEditorZoom("100"), 100);
    });
  });

  describe("3. Increment & Decrement Steps", () => {
    it("increments and decrements global zoom by STEP_GLOBAL_ZOOM", () => {
      assert.equal(incrementGlobalZoom(100), 110);
      assert.equal(incrementGlobalZoom(140), 150);
      assert.equal(incrementGlobalZoom(150), 150, "Should clamp at max global zoom");

      assert.equal(decrementGlobalZoom(100), 90);
      assert.equal(decrementGlobalZoom(80), 70);
      assert.equal(decrementGlobalZoom(70), 70, "Should clamp at min global zoom");
    });

    it("increments and decrements editor zoom by STEP_EDITOR_ZOOM", () => {
      assert.equal(incrementEditorZoom(100), 110);
      assert.equal(incrementEditorZoom(190), 200);
      assert.equal(incrementEditorZoom(200), 200, "Should clamp at max editor zoom");

      assert.equal(decrementEditorZoom(100), 90);
      assert.equal(decrementEditorZoom(80), 70);
      assert.equal(decrementEditorZoom(70), 70, "Should clamp at min editor zoom");
    });
  });

  describe("4. Independence of Global & Editor Zoom", () => {
    it("supports independent state combinations without interference", () => {
      const state1 = {
        global_zoom: clampGlobalZoom(90),
        editor_zoom: clampEditorZoom(125),
      };
      assert.equal(state1.global_zoom, 90);
      assert.equal(state1.editor_zoom, 125);

      const state2 = {
        global_zoom: clampGlobalZoom(100),
        editor_zoom: clampEditorZoom(150),
      };
      assert.equal(state2.global_zoom, 100);
      assert.equal(state2.editor_zoom, 150);

      const state3 = {
        global_zoom: clampGlobalZoom(110),
        editor_zoom: clampEditorZoom(90),
      };
      assert.equal(state3.global_zoom, 110);
      assert.equal(state3.editor_zoom, 90);
    });
  });

  describe("5. DOM Application", () => {
    it("applies zoom style and custom property to document element", () => {
      const styles = {};
      const properties = {};
      const origDoc = globalThis.document;

      globalThis.document = {
        documentElement: {
          style: {
            set zoom(val) {
              styles.zoom = val;
            },
            get zoom() {
              return styles.zoom;
            },
            setProperty: (prop, val) => {
              properties[prop] = val;
            },
          },
        },
      };

      try {
        applyGlobalZoom(110);
        assert.equal(styles.zoom, "1.1");
        assert.equal(properties["--kenote-global-zoom"], "1.1");

        applyGlobalZoom(90);
        assert.equal(styles.zoom, "0.9");
        assert.equal(properties["--kenote-global-zoom"], "0.9");

        applyGlobalZoom(200); // Exceeds max, should clamp to 150% -> 1.5
        assert.equal(styles.zoom, "1.5");
        assert.equal(properties["--kenote-global-zoom"], "1.5");
      } finally {
        globalThis.document = origDoc;
      }
    });
  });
});
