import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { searchAndReplacePluginKey } from "../extensions/SearchAndReplace";
import {
  ChevronDown,
  ChevronUp,
  X,
  CaseSensitive,
  WholeWord,
  Replace,
  ReplaceAll,
  Search,
} from "lucide-react";

export interface FindReplaceBarProps {
  isOpen: boolean;
  isReplaceMode: boolean;
  editor: TiptapEditor | null;
  onClose: () => void;
  onToggleReplaceMode?: () => void;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  isOpen,
  isReplaceMode,
  editor,
  onClose,
  onToggleReplaceMode,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(isReplaceMode);
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Sync showReplace with prop when opened or prop changes
  useEffect(() => {
    if (isOpen) {
      setShowReplace(isReplaceMode);
    }
  }, [isOpen, isReplaceMode]);

  // Read current search plugin state from editor
  const updateMatchInfo = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const pluginState = searchAndReplacePluginKey.getState(editor.state);
    if (pluginState) {
      setMatchCount(pluginState.results.length);
      setCurrentIndex(pluginState.currentIndex);
    } else {
      setMatchCount(0);
      setCurrentIndex(0);
    }
  }, [editor]);

  // Scroll active match into viewport smoothly
  const scrollToActiveMatch = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const pluginState = searchAndReplacePluginKey.getState(editor.state);
    if (!pluginState || pluginState.results.length === 0) return;

    const activeRange = pluginState.results[pluginState.currentIndex];
    if (!activeRange) return;

    try {
      const coords = editor.view.coordsAtPos(activeRange.from);
      const editorDom = editor.view.dom;
      const scrollParent = editorDom.closest(".overflow-y-auto") as HTMLElement | null;
      if (scrollParent && coords) {
        const parentRect = scrollParent.getBoundingClientRect();
        if (coords.top < parentRect.top + 50 || coords.bottom > parentRect.bottom - 50) {
          const targetTop =
            scrollParent.scrollTop + (coords.top - parentRect.top) - parentRect.height / 2;
          scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        }
      }
    } catch {
      // Ignore coords lookup if node is not visible
    }
  }, [editor]);

  // When isOpen changes
  useEffect(() => {
    if (!isOpen) {
      if (editor && !editor.isDestroyed) {
        editor.commands.clearSearch();
      }
      setSearchTerm("");
      setMatchCount(0);
      setCurrentIndex(0);
      return;
    }

    // If editor has single-line text selected, pre-fill search input
    if (editor && !editor.isDestroyed) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to).trim();
        if (selectedText.length > 0 && selectedText.length < 80 && !selectedText.includes("\n")) {
          setSearchTerm(selectedText);
          editor.commands.setSearchTerm(selectedText);
        }
      }
    }

    setTimeout(() => {
      if (isReplaceMode && replaceInputRef.current) {
        replaceInputRef.current.focus();
        replaceInputRef.current.select();
      } else if (findInputRef.current) {
        findInputRef.current.focus();
        findInputRef.current.select();
      }
    }, 50);
  }, [isOpen, editor, isReplaceMode]);

  // Listen to editor transactions to update match count and active index
  useEffect(() => {
    if (!isOpen || !editor || editor.isDestroyed) return;

    const handleTransaction = () => {
      updateMatchInfo();
    };

    editor.on("transaction", handleTransaction);
    updateMatchInfo();

    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [isOpen, editor, updateMatchInfo]);

  // When searchTerm changes
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    if (!editor || editor.isDestroyed) return;
    editor.commands.setSearchTerm(term);
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // When replaceTerm changes
  const handleReplaceChange = (term: string) => {
    setReplaceTerm(term);
    if (!editor || editor.isDestroyed) return;
    editor.commands.setReplaceTerm(term);
  };

  // Toggle case sensitive
  const handleToggleCase = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    if (!editor || editor.isDestroyed) return;
    editor.commands.setSearchOptions({ caseSensitive: next });
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // Toggle whole word
  const handleToggleWholeWord = () => {
    const next = !wholeWord;
    setWholeWord(next);
    if (!editor || editor.isDestroyed) return;
    editor.commands.setSearchOptions({ wholeWord: next });
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // Next match
  const handleNext = () => {
    if (!editor || editor.isDestroyed || matchCount === 0) return;
    editor.commands.nextSearchResult();
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // Prev match
  const handlePrev = () => {
    if (!editor || editor.isDestroyed || matchCount === 0) return;
    editor.commands.previousSearchResult();
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // Replace current
  const handleReplaceCurrent = () => {
    if (!editor || editor.isDestroyed || matchCount === 0) return;
    editor.commands.replaceCurrent();
    setTimeout(() => scrollToActiveMatch(), 20);
  };

  // Replace all
  const handleReplaceAll = () => {
    if (!editor || editor.isDestroyed || matchCount === 0) return;
    editor.commands.replaceAll();
  };

  // Close and refocus editor
  const handleClose = () => {
    onClose();
    if (editor && !editor.isDestroyed) {
      editor.commands.clearSearch();
      editor.commands.focus();
    }
  };

  // Keydown in find input
  const handleFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  // Keydown in replace input
  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        handleReplaceCurrent();
      } else {
        handleNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-3 right-4 z-30 select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="w-[340px] bg-[#1A202A] border border-[#2D3748] rounded-xl shadow-2xl p-2 flex flex-col space-y-1.5 backdrop-blur-md">
        {/* Find Row */}
        <div className="flex items-center space-x-1.5">
          <div className="flex-1 flex items-center bg-[#13171F] border border-[#2B3545] rounded-lg px-2 py-1 focus-within:border-[var(--accent-color,#0399F7)] transition-colors">
            <Search size={13} className="text-gray-500 shrink-0 mr-1.5" />
            <input
              ref={findInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleFindKeyDown}
              placeholder="Find in note..."
              className="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none"
            />
            {/* Match Counter Badge */}
            {searchTerm.trim().length > 0 && (
              <span
                className={`text-[10px] font-mono shrink-0 px-1 py-0.2 rounded ${
                  matchCount === 0
                    ? "text-red-400 bg-red-500/10"
                    : "text-gray-400 bg-[#1D2533]"
                }`}
              >
                {matchCount === 0 ? "0/0" : `${currentIndex + 1}/${matchCount}`}
              </span>
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center space-x-0.5">
            <button
              onClick={handlePrev}
              disabled={matchCount === 0}
              title="Previous match (Shift+Enter)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252E3E] disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={handleNext}
              disabled={matchCount === 0}
              title="Next match (Enter)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252E3E] disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Options Toggles */}
          <div className="flex items-center space-x-0.5 pl-0.5 border-l border-[#2B3545]">
            <button
              onClick={handleToggleCase}
              title={caseSensitive ? "Match case (Active)" : "Match case (Inactive)"}
              className={`p-1 rounded transition-colors focus:outline-none ${
                caseSensitive
                  ? "bg-[var(--accent-color,#0399F7)] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#252E3E]"
              }`}
            >
              <CaseSensitive size={14} />
            </button>
            <button
              onClick={handleToggleWholeWord}
              title={wholeWord ? "Match whole word (Active)" : "Match whole word (Inactive)"}
              className={`p-1 rounded transition-colors focus:outline-none ${
                wholeWord
                  ? "bg-[var(--accent-color,#0399F7)] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#252E3E]"
              }`}
            >
              <WholeWord size={14} />
            </button>
          </div>

          {/* Toggle Replace row */}
          <button
            onClick={() => {
              const next = !showReplace;
              setShowReplace(next);
              if (onToggleReplaceMode) onToggleReplaceMode();
              if (next) {
                setTimeout(() => replaceInputRef.current?.focus(), 30);
              }
            }}
            title={showReplace ? "Hide replace" : "Show replace (Ctrl+H)"}
            className={`p-1 rounded transition-colors focus:outline-none ${
              showReplace
                ? "text-[var(--accent-color,#0399F7)] bg-[#252E3E]"
                : "text-gray-400 hover:text-white hover:bg-[#252E3E]"
            }`}
          >
            <Replace size={14} />
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            title="Close (Escape)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252E3E] transition-colors focus:outline-none"
          >
            <X size={14} />
          </button>
        </div>

        {/* Replace Row */}
        {showReplace && (
          <div className="flex items-center space-x-1.5 pt-0.5 animate-in fade-in duration-100">
            <div className="flex-1 flex items-center bg-[#13171F] border border-[#2B3545] rounded-lg px-2 py-1 focus-within:border-[var(--accent-color,#0399F7)] transition-colors">
              <input
                ref={replaceInputRef}
                type="text"
                value={replaceTerm}
                onChange={(e) => handleReplaceChange(e.target.value)}
                onKeyDown={handleReplaceKeyDown}
                placeholder="Replace with..."
                className="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleReplaceCurrent}
              disabled={matchCount === 0}
              title="Replace current match (Ctrl+Shift+Enter)"
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#222A38] text-gray-200 hover:text-white hover:bg-[#2C3748] disabled:opacity-30 disabled:hover:bg-[#222A38] transition-colors focus:outline-none shrink-0"
            >
              Replace
            </button>

            <button
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title="Replace all matches"
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#222A38] text-gray-200 hover:text-white hover:bg-[#2C3748] disabled:opacity-30 disabled:hover:bg-[#222A38] transition-colors focus:outline-none shrink-0 flex items-center space-x-1"
            >
              <ReplaceAll size={12} />
              <span>All</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
