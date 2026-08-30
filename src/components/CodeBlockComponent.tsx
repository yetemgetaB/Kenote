import React, { useState } from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { CheckIcon, CopyIcon } from "./Icons";

export const CodeBlockComponent: React.FC<NodeViewProps> = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  updateAttributes,
  extension,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Get text content of code block
    const text = (extension as any)?.editor?.state?.doc?.textBetween(
      (extension as any)?.getPos?.() || 0,
      ((extension as any)?.getPos?.() || 0) + 1000,
      "\n"
    );
    navigator.clipboard.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NodeViewWrapper className="relative my-4 rounded-xl bg-[#1E242E] border border-[#2B3340] overflow-hidden group shadow-md">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#171C24] border-b border-[#2B3340] text-xs text-gray-400 select-none">
        <div className="flex items-center space-x-2">
          <select
            contentEditable={false}
            defaultValue={defaultLanguage || "auto"}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className="bg-transparent text-gray-300 hover:text-white focus:outline-none cursor-pointer text-xs"
          >
            <option value="auto" className="bg-[#1B2028] text-gray-200">Auto</option>
            <option value="javascript" className="bg-[#1B2028] text-gray-200">JavaScript</option>
            <option value="typescript" className="bg-[#1B2028] text-gray-200">TypeScript</option>
            <option value="html" className="bg-[#1B2028] text-gray-200">HTML</option>
            <option value="css" className="bg-[#1B2028] text-gray-200">CSS</option>
            <option value="json" className="bg-[#1B2028] text-gray-200">JSON</option>
            <option value="rust" className="bg-[#1B2028] text-gray-200">Rust</option>
            <option value="python" className="bg-[#1B2028] text-gray-200">Python</option>
            <option value="bash" className="bg-[#1B2028] text-gray-200">Bash</option>
            <option value="sql" className="bg-[#1B2028] text-gray-200">SQL</option>
            <option value="markdown" className="bg-[#1B2028] text-gray-200">Markdown</option>
          </select>
        </div>

        <button
          onClick={handleCopy}
          title="Copy code"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252C38] transition-colors focus:outline-none flex items-center space-x-1"
        >
          {copied ? (
            <>
              <CheckIcon size={13} className="text-green-400" />
              <span className="text-[11px] text-green-400">Copied</span>
            </>
          ) : (
            <CopyIcon size={13} />
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-[#E2E8F0] m-0">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};
