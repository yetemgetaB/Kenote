import MarkdownIt from "markdown-it";

// Strictly allow only http: and https: protocols
export function isValidHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type MarkdownItInstance = ReturnType<typeof MarkdownIt>;

// Create and configure a safe, limited markdown renderer
export function createSafeMarkdownRenderer(): MarkdownItInstance {
  const md = new MarkdownIt({
    html: false, // Disallow raw HTML tags (escapes <script>, <style>, etc.)
    linkify: true, // Autoconvert URL-like text to links
    breaks: true, // Convert \n into <br>
  });

  // Strict link validation: reject javascript:, data:, file:, vbscript:, etc.
  md.validateLink = (url: string) => {
    return isValidHttpUrl(url);
  };

  // Ensure all generated links have safe target and rel attributes
  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const hrefIndex = tokens[idx].attrIndex("href");
    if (hrefIndex >= 0 && tokens[idx].attrs) {
      const href = String(tokens[idx].attrs[hrefIndex][1]);
      if (!isValidHttpUrl(href)) {
        tokens[idx].attrs.splice(hrefIndex, 1);
      } else {
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener noreferrer");
      }
    }
    return defaultRender(tokens, idx, options, env, self);
  };

  return md;
}

export const safeMarkdownRenderer = createSafeMarkdownRenderer();

export function renderSafeMarkdown(content?: string): string {
  if (!content || !content.trim()) {
    return "<p>General stability and performance improvements.</p>";
  }
  return safeMarkdownRenderer.render(content.trim());
}
