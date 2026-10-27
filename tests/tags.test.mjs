import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTagsFromMarkdown,
  getAllUniqueTags,
  filterNotesByTag,
} from "../src/utils/tags.ts";

describe("Note Tags & Categorization Tests", () => {
  describe("1. extractTagsFromMarkdown", () => {
    it("extracts basic single and multiple tags", () => {
      const markdown = "Remember to buy groceries #shopping and finish report #work";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["shopping", "work"]);
    });

    it("extracts tags with underscores, hyphens, and nested slashes", () => {
      const markdown = "Working on #project-alpha and #dev/backend/auth with #v1_release";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["project-alpha", "dev/backend/auth", "v1_release"]);
    });

    it("does not treat markdown headings as tags", () => {
      const markdown = `# Title One
## Subheading
### Level Three Heading
Normal line text.`;
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, []);
    });

    it("extracts valid tags from within heading text", () => {
      const markdown = "# Meeting Agenda #work #urgent";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["work", "urgent"]);
    });

    it("ignores tags inside fenced code blocks", () => {
      const markdown = `Here is some normal text #validtag

\`\`\`rust
// In code block
let s = "#notataginblock";
\`\`\`

After code block #another_valid`;
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["validtag", "another_valid"]);
    });

    it("ignores tags inside inline code snippets", () => {
      const markdown = "Check `git checkout -b #notatag` for #features";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["features"]);
    });

    it("ignores URL anchors", () => {
      const markdown = "See https://github.com/yetemgetaB/Kenote/#readme for docs";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, []);
    });

    it("ignores issue numbers or digit-leading hashes", () => {
      const markdown = "Resolves issue #123 and pr #456 but adds #tag7";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["tag7"]);
    });

    it("extracts bracketed and parenthesized tags", () => {
      const markdown = "Check out (#ideas) and [#important] notes";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["ideas", "important"]);
    });

    it("normalizes to lowercase and deduplicates within the note", () => {
      const markdown = "#WORK #work #Work #todo";
      const tags = extractTagsFromMarkdown(markdown);
      assert.deepEqual(tags, ["work", "todo"]);
    });

    it("returns empty array for empty or whitespace content", () => {
      assert.deepEqual(extractTagsFromMarkdown(""), []);
      assert.deepEqual(extractTagsFromMarkdown("   \n\n  "), []);
    });
  });

  describe("2. getAllUniqueTags", () => {
    it("aggregates tags across multiple notes and sorts by frequency", () => {
      const notes = [
        {
          id: "1",
          filename: "1.md",
          title: "Note 1",
          content: "#work #important #client",
          tags: ["work", "important", "client"],
          updated_at: 100,
          created_at: 100,
          character_count: 50,
          is_pinned: false,
        },
        {
          id: "2",
          filename: "2.md",
          title: "Note 2",
          content: "#work #ideas",
          tags: ["work", "ideas"],
          updated_at: 200,
          created_at: 200,
          character_count: 40,
          is_pinned: false,
        },
        {
          id: "3",
          filename: "3.md",
          title: "Note 3",
          content: "#work #important",
          tags: ["work", "important"],
          updated_at: 300,
          created_at: 300,
          character_count: 30,
          is_pinned: false,
        },
      ];

      const uniqueTags = getAllUniqueTags(notes);
      assert.deepEqual(uniqueTags, [
        { tag: "work", count: 3 },
        { tag: "important", count: 2 },
        { tag: "client", count: 1 },
        { tag: "ideas", count: 1 },
      ]);
    });

    it("falls back to parsing content when tags property is omitted", () => {
      const notes = [
        {
          id: "1",
          filename: "1.md",
          title: "Note 1",
          content: "Some content with #dynamic_tag",
          updated_at: 100,
          created_at: 100,
          character_count: 50,
          is_pinned: false,
        },
      ];

      const uniqueTags = getAllUniqueTags(notes);
      assert.deepEqual(uniqueTags, [{ tag: "dynamic_tag", count: 1 }]);
    });
  });

  describe("3. filterNotesByTag", () => {
    const notes = [
      {
        id: "1",
        filename: "1.md",
        title: "Work Project",
        content: "#work #project",
        tags: ["work", "project"],
        updated_at: 100,
        created_at: 100,
        character_count: 50,
        is_pinned: false,
      },
      {
        id: "2",
        filename: "2.md",
        title: "Grocery List",
        content: "#personal #shopping",
        tags: ["personal", "shopping"],
        updated_at: 200,
        created_at: 200,
        character_count: 40,
        is_pinned: false,
      },
      {
        id: "3",
        filename: "3.md",
        title: "Quarterly Goals",
        content: "#work #planning",
        tags: ["work", "planning"],
        updated_at: 300,
        created_at: 300,
        character_count: 30,
        is_pinned: false,
      },
    ];

    it("returns all notes when selectedTag is null or empty", () => {
      assert.equal(filterNotesByTag(notes, null).length, 3);
      assert.equal(filterNotesByTag(notes, "").length, 3);
    });

    it("filters notes containing the target tag", () => {
      const filtered = filterNotesByTag(notes, "work");
      assert.equal(filtered.length, 2);
      assert.equal(filtered[0].id, "1");
      assert.equal(filtered[1].id, "3");
    });

    it("handles leading # in filter target gracefully", () => {
      const filtered = filterNotesByTag(notes, "#personal");
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "2");
    });

    it("returns empty array when no notes match tag", () => {
      assert.deepEqual(filterNotesByTag(notes, "nonexistent"), []);
    });
  });
});
