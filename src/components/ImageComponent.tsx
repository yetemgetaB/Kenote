import React, { useState, useEffect, useRef } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { api } from "../utils/tauriBridge";
import { CopyIcon, CheckIcon, TrashIcon, SearchIcon, ImageIcon } from "./Icons";

export const ImageComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
}) => {
  const { src, alt, title } = node.attrs;
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [caption, setCaption] = useState(alt || "");
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    api
      .resolveAssetUrl(src)
      .then((url) => {
        if (!isMounted) return;
        setResolvedUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleCopyImage = async () => {
    try {
      if (resolvedUrl.startsWith("data:")) {
        const res = await fetch(resolvedUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      } else {
        await navigator.clipboard.writeText(src);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Could not copy image to clipboard, falling back to URL:", err);
      navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCaptionBlur = () => {
    setIsEditingCaption(false);
    updateAttributes({ alt: caption });
  };

  const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      captionInputRef.current?.blur();
    }
  };

  return (
    <NodeViewWrapper className="relative my-4 group select-none">
      <div className="relative rounded-xl overflow-hidden border border-[#2A3240] bg-[#161B22] transition-all hover:border-[#38BDF8]/40 shadow-lg inline-block max-w-full">
        {/* Loading state */}
        {loading && (
          <div className="w-full h-48 flex items-center justify-center bg-[#171C24] text-gray-500 animate-pulse">
            <div className="flex items-center space-x-2 text-xs">
              <ImageIcon size={18} className="animate-spin text-[#38BDF8]" />
              <span>Loading image...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="w-full p-6 flex flex-col items-center justify-center bg-[#1E242E] text-gray-400 space-y-2">
            <ImageIcon size={28} className="text-red-400/80" />
            <span className="text-xs text-red-300 font-medium">Failed to load image</span>
            <span className="text-[11px] text-gray-500 font-mono break-all max-w-xs">{src}</span>
            <button
              onClick={deleteNode}
              className="mt-2 text-xs px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
            >
              Remove
            </button>
          </div>
        )}

        {/* Image Display */}
        {!loading && !error && resolvedUrl && (
          <>
            <img
              src={resolvedUrl}
              alt={alt || "Note attachment"}
              title={title || alt || ""}
              onLoad={() => setLoading(false)}
              onError={() => setError(true)}
              className="max-w-full max-h-[500px] object-contain rounded-xl block cursor-zoom-in"
              onClick={() => setIsLightboxOpen(true)}
              draggable={false}
            />

            {/* Hover Action Bar */}
            <div
              contentEditable={false}
              className="absolute top-2 right-2 flex items-center space-x-1 bg-[#12161D]/85 backdrop-blur-md px-1.5 py-1 rounded-lg border border-[#2B3545] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
            >
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                title="Zoom preview"
                className="p-1 hover:bg-[#252E3C] text-gray-300 hover:text-white rounded transition-colors"
              >
                <SearchIcon size={13} />
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                title={copied ? "Copied!" : "Copy image"}
                className="p-1 hover:bg-[#252E3C] text-gray-300 hover:text-white rounded transition-colors"
              >
                {copied ? <CheckIcon size={13} className="text-emerald-400" /> : <CopyIcon size={13} />}
              </button>
              <button
                type="button"
                onClick={deleteNode}
                title="Delete image"
                className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
              >
                <TrashIcon size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Caption input / display */}
      <div contentEditable={false} className="mt-1.5 px-1 max-w-full">
        {isEditingCaption ? (
          <input
            ref={captionInputRef}
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={handleCaptionBlur}
            onKeyDown={handleCaptionKeyDown}
            autoFocus
            placeholder="Add an image caption..."
            className="w-full bg-[#171C24] border border-[#2B3545] rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-[#38BDF8]"
          />
        ) : (
          <div
            onClick={() => {
              setIsEditingCaption(true);
            }}
            className="text-[11px] text-gray-500 hover:text-gray-400 cursor-pointer italic truncate transition-colors"
          >
            {caption || "Add a caption..."}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          contentEditable={false}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvedUrl}
              alt={alt || "Note attachment"}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />
            {caption && (
              <p className="mt-3 text-xs text-gray-300 text-center font-medium bg-black/60 px-3 py-1 rounded-full border border-white/10">
                {caption}
              </p>
            )}
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#1E242E] border border-white/20 text-white flex items-center justify-center shadow-xl hover:bg-[#2A3442] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
};
