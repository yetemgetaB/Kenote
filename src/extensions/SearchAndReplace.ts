import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface SearchAndReplacePluginState {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  currentIndex: number;
  results: { from: number; to: number }[];
}

export const searchAndReplacePluginKey = new PluginKey<SearchAndReplacePluginState>(
  "searchAndReplace"
);

export function buildSearchRegex(
  term: string,
  caseSensitive: boolean,
  wholeWord: boolean
): RegExp | null {
  if (!term) return null;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = caseSensitive ? "g" : "gi";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function findMatchesInDoc(
  doc: ProseMirrorNode,
  regex: RegExp | null
): { from: number; to: number }[] {
  if (!regex) return [];
  const results: { from: number; to: number }[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      const from = pos + match.index;
      const to = from + match[0].length;
      results.push({ from, to });
    }
  });

  return results;
}

export type SearchAction =
  | { type: "SET_SEARCH_TERM"; searchTerm: string }
  | { type: "SET_REPLACE_TERM"; replaceTerm: string }
  | { type: "SET_OPTIONS"; caseSensitive?: boolean; wholeWord?: boolean }
  | { type: "NEXT_MATCH" }
  | { type: "PREV_MATCH" }
  | { type: "SET_INDEX"; index: number }
  | { type: "CLEAR" };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setSearchOptions: (options: { caseSensitive?: boolean; wholeWord?: boolean }) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      setSearchIndex: (index: number) => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchAndReplace = Extension.create({
  name: "searchAndReplace",

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "SET_SEARCH_TERM",
              searchTerm,
            } as SearchAction);
          }
          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "SET_REPLACE_TERM",
              replaceTerm,
            } as SearchAction);
          }
          return true;
        },

      setSearchOptions:
        (options) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "SET_OPTIONS",
              ...options,
            } as SearchAction);
          }
          return true;
        },

      nextSearchResult:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "NEXT_MATCH",
            } as SearchAction);
          }
          return true;
        },

      previousSearchResult:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "PREV_MATCH",
            } as SearchAction);
          }
          return true;
        },

      setSearchIndex:
        (index: number) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "SET_INDEX",
              index,
            } as SearchAction);
          }
          return true;
        },

      replaceCurrent:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchAndReplacePluginKey.getState(state);
          if (!pluginState || pluginState.results.length === 0) return false;

          const currentMatch = pluginState.results[pluginState.currentIndex];
          if (!currentMatch) return false;

          if (dispatch) {
            tr.insertText(pluginState.replaceTerm, currentMatch.from, currentMatch.to);
            dispatch(tr);
          }
          return true;
        },

      replaceAll:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = searchAndReplacePluginKey.getState(state);
          if (!pluginState || pluginState.results.length === 0) return false;

          if (dispatch) {
            // Replace in reverse order so document positions don't shift
            for (let i = pluginState.results.length - 1; i >= 0; i--) {
              const { from, to } = pluginState.results[i];
              tr.insertText(pluginState.replaceTerm, from, to);
            }
            dispatch(tr);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchAndReplacePluginKey, {
              type: "CLEAR",
            } as SearchAction);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchAndReplacePluginState>({
        key: searchAndReplacePluginKey,

        state: {
          init(): SearchAndReplacePluginState {
            return {
              searchTerm: "",
              replaceTerm: "",
              caseSensitive: false,
              wholeWord: false,
              currentIndex: 0,
              results: [],
            };
          },

          apply(tr, prev, _oldState, newState): SearchAndReplacePluginState {
            const meta = tr.getMeta(searchAndReplacePluginKey) as SearchAction | undefined;

            let nextState = { ...prev };

            if (meta) {
              switch (meta.type) {
                case "SET_SEARCH_TERM":
                  nextState.searchTerm = meta.searchTerm;
                  nextState.currentIndex = 0;
                  break;
                case "SET_REPLACE_TERM":
                  nextState.replaceTerm = meta.replaceTerm;
                  break;
                case "SET_OPTIONS":
                  if (meta.caseSensitive !== undefined) {
                    nextState.caseSensitive = meta.caseSensitive;
                  }
                  if (meta.wholeWord !== undefined) {
                    nextState.wholeWord = meta.wholeWord;
                  }
                  nextState.currentIndex = 0;
                  break;
                case "NEXT_MATCH":
                  if (nextState.results.length > 0) {
                    nextState.currentIndex =
                      (nextState.currentIndex + 1) % nextState.results.length;
                  }
                  break;
                case "PREV_MATCH":
                  if (nextState.results.length > 0) {
                    nextState.currentIndex =
                      (nextState.currentIndex - 1 + nextState.results.length) %
                      nextState.results.length;
                  }
                  break;
                case "SET_INDEX":
                  if (nextState.results.length > 0) {
                    nextState.currentIndex = Math.max(
                      0,
                      Math.min(meta.index, nextState.results.length - 1)
                    );
                  }
                  break;
                case "CLEAR":
                  return {
                    searchTerm: "",
                    replaceTerm: "",
                    caseSensitive: false,
                    wholeWord: false,
                    currentIndex: 0,
                    results: [],
                  };
              }
            }

            // If query or options changed, or if document content changed, re-run search
            if (
              meta?.type === "SET_SEARCH_TERM" ||
              meta?.type === "SET_OPTIONS" ||
              tr.docChanged
            ) {
              const regex = buildSearchRegex(
                nextState.searchTerm,
                nextState.caseSensitive,
                nextState.wholeWord
              );
              nextState.results = findMatchesInDoc(newState.doc, regex);
              if (nextState.results.length === 0) {
                nextState.currentIndex = 0;
              } else if (nextState.currentIndex >= nextState.results.length) {
                nextState.currentIndex = nextState.results.length - 1;
              }
            }

            return nextState;
          },
        },

        props: {
          decorations(state) {
            const pluginState = searchAndReplacePluginKey.getState(state);
            if (!pluginState || pluginState.results.length === 0) {
              return DecorationSet.empty;
            }

            const decorations = pluginState.results.map((range, idx) => {
              const isActive = idx === pluginState.currentIndex;
              return Decoration.inline(range.from, range.to, {
                class: isActive
                  ? "kenote-search-match-active"
                  : "kenote-search-match",
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
