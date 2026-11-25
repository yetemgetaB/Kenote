import React from "react";
import { NoteMetadata } from "../../types/note";
import { RotateCcw, Trash2 } from "lucide-react";

interface TrashTabProps {
  trashedNotes: NoteMetadata[];
  trashSearch: string;
  trashActionError: string | null;
  onTrashSearchChange: (value: string) => void;
  onEmptyTrash: () => void;
  onRestoreNote: (note: NoteMetadata) => void;
  onPermanentDelete: (note: NoteMetadata) => void;
}

export const TrashTab: React.FC<TrashTabProps> = ({
  trashedNotes,
  trashSearch,
  trashActionError,
  onTrashSearchChange,
  onEmptyTrash,
  onRestoreNote,
  onPermanentDelete,
}) => {
  const filteredTrash = trashedNotes.filter(
    (n) =>
      n.title.toLowerCase().includes(trashSearch.toLowerCase()) ||
      n.content.toLowerCase().includes(trashSearch.toLowerCase())
  );

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            Trash Manager
          </h2>
          <p className="text-[11px] text-gray-400">
            Recover or delete trashed notes permanently.
          </p>
        </div>

        {trashedNotes.length > 0 && (
          <button
            onClick={onEmptyTrash}
            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all focus:outline-none"
          >
            Empty Trash ({trashedNotes.length})
          </button>
        )}
      </div>

      {trashActionError && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {trashActionError}
        </div>
      )}

      {/* Search Bar for Trash */}
      <input
        type="text"
        value={trashSearch}
        onChange={(e) => onTrashSearchChange(e.target.value)}
        placeholder="Search trashed notes..."
        className="w-full bg-[#141820] border border-[#2B3442] rounded-xl px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[var(--accent-color,#0399F7)]"
      />

      {/* Trashed Notes List */}
      <div className="space-y-1.5">
        {filteredTrash.length === 0 ? (
          <div className="p-8 text-center bg-[#1B212B] border border-[#2B3442] rounded-xl text-xs text-gray-500">
            {trashedNotes.length === 0
              ? "Trash is empty."
              : "No matching trashed notes."}
          </div>
        ) : (
          filteredTrash.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl flex items-center justify-between hover:border-[#384457] transition-all gap-2"
            >
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="text-xs font-semibold text-white truncate">
                  {note.title || "Untitled"}
                </h4>
                <div className="text-[10px] text-gray-500 mt-0.5 flex items-center space-x-1.5">
                  <span>{new Date(note.updated_at * 1000).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{note.character_count} chars</span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => onRestoreNote(note)}
                  className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center space-x-1 transition-colors focus:outline-none"
                >
                  <RotateCcw size={12} />
                  <span>Restore</span>
                </button>
                <button
                  onClick={() => onPermanentDelete(note)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none"
                  title="Delete Permanently"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
