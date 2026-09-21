import React, { useMemo } from "react";
import { api } from "../utils/tauriBridge.ts";
import { renderSafeMarkdown, isValidHttpUrl } from "../utils/markdown.ts";

interface ReleaseNotesViewProps {
  content?: string;
  className?: string;
  maxHeightClass?: string;
}

export const ReleaseNotesView: React.FC<ReleaseNotesViewProps> = ({
  content,
  className = "",
  maxHeightClass = "max-h-40",
}) => {
  const renderedHtml = useMemo(() => {
    return renderSafeMarkdown(content);
  }, [content]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor && anchor.href) {
      e.preventDefault();
      if (isValidHttpUrl(anchor.href)) {
        api.openExternal(anchor.href);
      }
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`release-notes-content overflow-y-auto custom-scrollbar ${maxHeightClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
