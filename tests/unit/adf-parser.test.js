import { describe, it, expect } from 'vitest';
import { adfToMarkdown } from '../../src/parsers/adf-parser.js';

// ---------------------------------------------------------------------------
// Helpers to build ADF nodes concisely
// ---------------------------------------------------------------------------
const doc = (...content) => ({ type: 'doc', content });
const paragraph = (...content) => ({ type: 'paragraph', content });
const text = (t, marks = []) => ({ type: 'text', text: t, marks });
const mark = (type, attrs = {}) => ({ type, attrs });
const heading = (level, ...content) => ({
  type: 'heading',
  attrs: { level },
  content,
});
const bulletList = (...items) => ({ type: 'bulletList', content: items });
const orderedList = (...items) => ({ type: 'orderedList', content: items });
const listItem = (...content) => ({ type: 'listItem', content });
const codeBlock = (language, code) => ({
  type: 'codeBlock',
  attrs: { language },
  content: [{ type: 'text', text: code }],
});
const blockquote = (...content) => ({ type: 'blockquote', content });
const rule = () => ({ type: 'rule' });
const hardBreak = () => ({ type: 'hardBreak' });
const panel = (panelType, ...content) => ({
  type: 'panel',
  attrs: { panelType },
  content,
});
const inlineCard = (url) => ({ type: 'inlineCard', attrs: { url } });
const mention = (id, displayName) => ({
  type: 'mention',
  attrs: { id, displayName },
});
const emoji = (shortName, textVal) => ({
  type: 'emoji',
  attrs: { shortName, text: textVal },
});
const table = (...rows) => ({ type: 'table', content: rows });
const tableRow = (...cells) => ({ type: 'tableRow', content: cells });
const tableHeader = (...content) => ({ type: 'tableHeader', content });
const tableCell = (...content) => ({ type: 'tableCell', content });
const mediaSingle = (url, alt = 'image') => ({
  type: 'mediaSingle',
  content: [{ type: 'media', attrs: { url, alt } }],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('adfToMarkdown', () => {
  // 1. Null / undefined input
  it('returns empty string for null input', () => {
    expect(adfToMarkdown(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(adfToMarkdown(undefined)).toBe('');
  });

  // 2. Empty doc
  it('returns empty string for empty doc', () => {
    expect(adfToMarkdown(doc())).toBe('');
  });

  // 3. Paragraph with plain text
  it('renders a paragraph with plain text', () => {
    const input = doc(paragraph(text('Hello, world!')));
    expect(adfToMarkdown(input)).toBe('Hello, world!');
  });

  // 4. Multiple paragraphs
  it('separates paragraphs with double newlines', () => {
    const input = doc(
      paragraph(text('First')),
      paragraph(text('Second'))
    );
    expect(adfToMarkdown(input)).toBe('First\n\nSecond');
  });

  // 5. Headings h1–h3
  it('renders h1 heading', () => {
    const input = doc(heading(1, text('Title')));
    expect(adfToMarkdown(input)).toBe('# Title');
  });

  it('renders h2 heading', () => {
    const input = doc(heading(2, text('Subtitle')));
    expect(adfToMarkdown(input)).toBe('## Subtitle');
  });

  it('renders h3 heading', () => {
    const input = doc(heading(3, text('Section')));
    expect(adfToMarkdown(input)).toBe('### Section');
  });

  // 6. Text marks — bold
  it('renders bold text', () => {
    const input = doc(paragraph(text('bold', [mark('strong')])));
    expect(adfToMarkdown(input)).toBe('**bold**');
  });

  // 7. Text marks — italic
  it('renders italic text', () => {
    const input = doc(paragraph(text('italic', [mark('em')])));
    expect(adfToMarkdown(input)).toBe('*italic*');
  });

  // 8. Text marks — inline code
  it('renders inline code', () => {
    const input = doc(paragraph(text('myFunc()', [mark('code')])));
    expect(adfToMarkdown(input)).toBe('`myFunc()`');
  });

  // 9. Text marks — link
  it('renders link', () => {
    const input = doc(
      paragraph(
        text('Click here', [mark('link', { href: 'https://example.com' })])
      )
    );
    expect(adfToMarkdown(input)).toBe('[Click here](https://example.com)');
  });

  // 10. Text marks — strikethrough
  it('renders strikethrough text', () => {
    const input = doc(paragraph(text('old text', [mark('strike')])));
    expect(adfToMarkdown(input)).toBe('~~old text~~');
  });

  // 11. Text marks — underline
  it('renders underline text', () => {
    const input = doc(paragraph(text('underlined', [mark('underline')])));
    expect(adfToMarkdown(input)).toBe('<u>underlined</u>');
  });

  // 12. Bullet list
  it('renders a bullet list', () => {
    const input = doc(
      bulletList(
        listItem(paragraph(text('Item A'))),
        listItem(paragraph(text('Item B'))),
        listItem(paragraph(text('Item C')))
      )
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('- Item A');
    expect(result).toContain('- Item B');
    expect(result).toContain('- Item C');
  });

  // 13. Ordered list
  it('renders an ordered list', () => {
    const input = doc(
      orderedList(
        listItem(paragraph(text('First'))),
        listItem(paragraph(text('Second'))),
        listItem(paragraph(text('Third')))
      )
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
    expect(result).toContain('3. Third');
  });

  // 14. Code block with language
  it('renders a code block with language', () => {
    const input = doc(codeBlock('javascript', 'const x = 1;'));
    expect(adfToMarkdown(input)).toBe('```javascript\nconst x = 1;\n```');
  });

  it('renders a code block without language', () => {
    const input = doc(codeBlock('', 'plain code'));
    expect(adfToMarkdown(input)).toBe('```\nplain code\n```');
  });

  // 15. Blockquote
  it('renders a blockquote', () => {
    const input = doc(blockquote(paragraph(text('Quoted text'))));
    const result = adfToMarkdown(input);
    expect(result).toContain('> Quoted text');
  });

  // 16. Horizontal rule
  it('renders a horizontal rule', () => {
    const input = doc(rule());
    expect(adfToMarkdown(input)).toBe('---');
  });

  // 17. Hard break
  it('renders a hard break as newline', () => {
    const input = doc(
      paragraph(text('Line 1'), hardBreak(), text('Line 2'))
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('Line 1');
    expect(result).toContain('\n');
    expect(result).toContain('Line 2');
  });

  // 18. Table with header row
  it('renders a table with header row', () => {
    const input = doc(
      table(
        tableRow(
          tableHeader(paragraph(text('Name'))),
          tableHeader(paragraph(text('Value')))
        ),
        tableRow(
          tableCell(paragraph(text('foo'))),
          tableCell(paragraph(text('bar')))
        )
      )
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('| Name | Value |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| foo | bar |');
  });

  // 19. Panel — warning type
  it('renders a warning panel with emoji prefix', () => {
    const input = doc(
      panel('warning', paragraph(text('Watch out!')))
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('⚠️');
    expect(result).toContain('Watch out!');
    expect(result).toMatch(/^>/m);
  });

  // 20. Panel — info type
  it('renders an info panel with emoji prefix', () => {
    const input = doc(
      panel('info', paragraph(text('Just FYI')))
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('ℹ️');
    expect(result).toContain('Just FYI');
  });

  // 21. Panel — error type
  it('renders an error panel with emoji prefix', () => {
    const input = doc(
      panel('error', paragraph(text('Critical error')))
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('🚫');
    expect(result).toContain('Critical error');
  });

  // 22. InlineCard (Figma / Confluence links)
  it('renders an inlineCard as a markdown link', () => {
    const url = 'https://www.figma.com/file/abc123/Design';
    const input = doc(paragraph(inlineCard(url)));
    const result = adfToMarkdown(input);
    expect(result).toContain(`[${url}](${url})`);
  });

  it('renders a Confluence inlineCard link', () => {
    const url = 'https://company.atlassian.net/wiki/spaces/DEV/overview';
    const input = doc(paragraph(inlineCard(url)));
    const result = adfToMarkdown(input);
    expect(result).toContain(`[${url}](${url})`);
  });

  // 23. Mention
  it('renders a mention with @ prefix', () => {
    const input = doc(paragraph(mention('user123', 'John Doe')));
    const result = adfToMarkdown(input);
    expect(result).toContain('@John Doe');
  });

  it('renders a mention without displayName using id', () => {
    const input = doc(
      paragraph({ type: 'mention', attrs: { id: 'user456' } })
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('@user456');
  });

  // 24. Emoji
  it('renders emoji text when available', () => {
    const input = doc(paragraph(emoji(':thumbsup:', '👍')));
    const result = adfToMarkdown(input);
    expect(result).toContain('👍');
  });

  it('renders emoji shortName when text is not available', () => {
    const input = doc(paragraph({ type: 'emoji', attrs: { shortName: ':wave:' } }));
    const result = adfToMarkdown(input);
    expect(result).toContain(':wave:');
  });

  // 25. mediaSingle / media
  it('renders an image from mediaSingle', () => {
    const input = doc(mediaSingle('https://example.com/img.png', 'Screenshot'));
    const result = adfToMarkdown(input);
    expect(result).toContain('![Screenshot](https://example.com/img.png)');
  });

  // 26. Combined marks (bold + italic)
  it('renders text with multiple marks', () => {
    const input = doc(
      paragraph(text('important', [mark('strong'), mark('em')]))
    );
    const result = adfToMarkdown(input);
    // Both marks applied (order may vary but both present)
    expect(result).toContain('important');
    expect(result).toContain('**');
    expect(result).toContain('*');
  });

  // 27. Heading followed by paragraph
  it('renders heading followed by paragraph', () => {
    const input = doc(
      heading(1, text('Title')),
      paragraph(text('Body text here.'))
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('# Title');
    expect(result).toContain('Body text here.');
  });

  // 28. Nested list items
  it('renders nested bullet list with indentation', () => {
    const input = doc(
      bulletList(
        listItem(
          paragraph(text('Parent')),
          bulletList(listItem(paragraph(text('Child'))))
        )
      )
    );
    const result = adfToMarkdown(input);
    expect(result).toContain('- Parent');
    expect(result).toContain('- Child');
  });

  // 29. Unknown node type falls back gracefully
  it('handles unknown node types without throwing', () => {
    const input = doc({ type: 'unknownNode', content: [paragraph(text('safe'))] });
    expect(() => adfToMarkdown(input)).not.toThrow();
  });

  // 30. Empty paragraph
  it('handles empty paragraph without throwing', () => {
    const input = doc(paragraph());
    expect(() => adfToMarkdown(input)).not.toThrow();
  });
});
