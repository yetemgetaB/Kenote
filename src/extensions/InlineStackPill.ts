import { Extension, InputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor as TiptapEditor } from "@tiptap/core";

export interface InlineStackPillPluginState {
  active: boolean;
  pos: number;
}

export const inlineStackPillPluginKey = new PluginKey<InlineStackPillPluginState>("inlineStackPill");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineStackPill: {
      /**
       * Activate the inline stack pill at the target position or current cursor
       */
      activateInlineStackPill: (options?: { pos?: number }) => ReturnType;
      /**
       * Deactivate and dismiss the inline stack pill
       */
      deactivateInlineStackPill: () => ReturnType;
    };
  }
}

function renderPillDOM(editor: TiptapEditor) {
  const container = document.createElement("span");
  container.className =
    "kenote-inline-stack-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#38BDF8]/40 bg-[#181D24] shadow-sm select-none align-middle text-xs";
  container.style.verticalAlign = "middle";
  container.style.margin = "1px 0";
  container.setAttribute("data-inline-pill", "stack");

  // Inline Badge
  const badge = document.createElement("span");
  badge.className =
    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] text-[11px] font-semibold leading-none shrink-0 border border-[#38BDF8]/25 select-none";
  badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="9" rx="2" /><polyline points="7 7.5 9 9.5 11 7.5" /><line x1="14" y1="7.5" x2="18" y2="7.5" /><path d="M5 16h14a2 2 0 0 0 2-2v0M5 20h14a2 2 0 0 0 2-2v0" /></svg><span>Stack</span>`;
  container.appendChild(badge);

  // Input
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Stack title (optional)...";
  input.className =
    "bg-transparent text-[13px] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none border-none p-0 tracking-wide font-normal";
  input.style.width = "180px";
  container.appendChild(input);

  // Auto-resize input as user types
  input.addEventListener("input", () => {
    input.style.width = `${Math.max(160, Math.min(320, (input.value.length + 1) * 8.5))}px`;
  });

  // Submit button
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className =
    "flex items-center justify-center text-[10px] font-mono text-[#64748B] hover:text-[#94A3B8] cursor-pointer select-none px-1 py-0.5 rounded hover:bg-[#2A3241] transition-colors";
  submitBtn.title = "Press Enter to create stack";
  submitBtn.innerHTML = "<span>↵</span>";
  container.appendChild(submitBtn);

  const submit = () => {
    const title = input.value.trim() || "Untitled Section";
    editor.commands.deactivateInlineStackPill();
    editor.commands.insertSection({ title });
  };

  const cancel = () => {
    editor.commands.deactivateInlineStackPill();
    editor.commands.focus();
  };

  submitBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  submitBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    submit();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Backspace" && input.value === "") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  });

  input.addEventListener("blur", (e) => {
    if (e.relatedTarget === submitBtn) return;
    setTimeout(() => {
      if (!editor.isDestroyed) {
        const state = inlineStackPillPluginKey.getState(editor.state);
        if (state?.active) {
          editor.commands.deactivateInlineStackPill();
        }
      }
    }, 120);
  });

  requestAnimationFrame(() => {
    input.focus();
  });

  return container;
}

export const InlineStackPill = Extension.create({
  name: "inlineStackPill",

  addCommands() {
    return {
      activateInlineStackPill:
        (options) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const pos = options?.pos ?? selection.from;
          if (dispatch) {
            const tr = state.tr.setMeta(inlineStackPillPluginKey, { active: true, pos });
            dispatch(tr);
          }
          return true;
        },
      deactivateInlineStackPill:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            const tr = state.tr.setMeta(inlineStackPillPluginKey, { active: false, pos: 0 });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\/(?:stack|section)\s$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          tr.delete(range.from, range.to);
          tr.setMeta(inlineStackPillPluginKey, { active: true, pos: range.from });
          tr.scrollIntoView();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: inlineStackPillPluginKey,
        state: {
          init: () => ({ active: false, pos: 0 }),
          apply: (tr, value) => {
            const meta = tr.getMeta(inlineStackPillPluginKey);
            if (meta !== undefined) {
              return meta;
            }
            if (value.active) {
              if (tr.docChanged) {
                try {
                  const mappedPos = tr.mapping.map(value.pos);
                  if (mappedPos >= 0 && mappedPos <= tr.doc.content.size) {
                    return { active: true, pos: mappedPos };
                  }
                } catch {
                  return { active: false, pos: 0 };
                }
              }
              return value;
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const pillState = inlineStackPillPluginKey.getState(state);
            if (!pillState || !pillState.active) {
              return DecorationSet.empty;
            }
            const pos = Math.min(Math.max(0, pillState.pos), state.doc.content.size);
            const widget = Decoration.widget(
              pos,
              () => renderPillDOM(editor),
              { side: 0, stopEvent: () => true }
            );
            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});
