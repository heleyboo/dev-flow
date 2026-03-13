/**
 * ADF (Atlassian Document Format) to Markdown parser.
 * Converts Jira's ADF JSON format to plain Markdown text.
 */

/**
 * Apply text marks (bold, italic, code, link, etc.) to a text string.
 * @param {string} text
 * @param {Array} marks
 * @returns {string}
 */
function applyMarks(text, marks) {
  if (!marks || marks.length === 0) return text;

  let result = text;

  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        result = `**${result}**`;
        break;
      case 'em':
        result = `*${result}*`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'link': {
        const href = mark.attrs?.href || '';
        result = `[${result}](${href})`;
        break;
      }
      default:
        break;
    }
  }

  return result;
}

/**
 * Render a table node to markdown.
 * @param {object} tableNode
 * @returns {string}
 */
function renderTable(tableNode) {
  if (!tableNode.content || tableNode.content.length === 0) return '';

  const rows = tableNode.content.filter(
    (n) => n.type === 'tableRow'
  );

  if (rows.length === 0) return '';

  const renderedRows = rows.map((row) => {
    const cells = (row.content || []).filter(
      (n) => n.type === 'tableHeader' || n.type === 'tableCell'
    );
    const cellContents = cells.map((cell) => {
      const content = renderNodes(cell.content || []).trim();
      return content.replace(/\n+/g, ' ');
    });
    return `| ${cellContents.join(' | ')} |`;
  });

  const lines = [];
  lines.push(renderedRows[0]);

  // Determine separator based on first row cell count
  const firstRow = rows[0];
  const headerCells = (firstRow.content || []).filter(
    (n) => n.type === 'tableHeader' || n.type === 'tableCell'
  );
  const sepCount = headerCells.length;
  lines.push(`| ${Array(sepCount).fill('---').join(' | ')} |`);

  for (let i = 1; i < renderedRows.length; i++) {
    lines.push(renderedRows[i]);
  }

  return lines.join('\n') + '\n\n';
}

/**
 * Render a list item to markdown with the given prefix.
 * @param {object} item - listItem node
 * @param {string} prefix - e.g. '- ' or '1. '
 * @param {number} depth - indentation depth
 * @returns {string}
 */
function renderListItem(item, prefix, depth = 0) {
  const indent = '  '.repeat(depth);
  const lines = [];

  for (const child of item.content || []) {
    if (child.type === 'paragraph') {
      const text = renderNodes(child.content || []).trim();
      lines.push(`${indent}${prefix}${text}`);
    } else if (child.type === 'bulletList') {
      const subItems = renderList(child, '-', depth + 1);
      lines.push(subItems.trimEnd());
    } else if (child.type === 'orderedList') {
      const subItems = renderList(child, '1.', depth + 1);
      lines.push(subItems.trimEnd());
    } else {
      const text = renderNode(child).trim();
      if (text) lines.push(`${indent}${prefix}${text}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render a bulletList or orderedList node.
 * @param {object} listNode
 * @param {string} marker - '-' or '1.'
 * @param {number} depth
 * @returns {string}
 */
function renderList(listNode, marker, depth = 0) {
  const items = (listNode.content || []).filter(
    (n) => n.type === 'listItem'
  );

  if (items.length === 0) return '';

  let counter = 1;
  const lines = [];

  for (const item of items) {
    const prefix = marker === '-' ? '- ' : `${counter}. `;
    lines.push(renderListItem(item, prefix, depth));
    if (marker !== '-') counter++;
  }

  return lines.join('\n') + '\n\n';
}

/**
 * Render a single ADF node to a markdown string.
 * @param {object} node
 * @returns {string}
 */
function renderNode(node) {
  if (!node || !node.type) return '';

  switch (node.type) {
    case 'doc':
      return renderNodes(node.content || []);

    case 'paragraph': {
      const text = renderNodes(node.content || []);
      if (!text.trim()) return '\n';
      return text + '\n\n';
    }

    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
      const prefix = '#'.repeat(level);
      const text = renderNodes(node.content || []).trim();
      return `${prefix} ${text}\n\n`;
    }

    case 'text': {
      const raw = node.text || '';
      return applyMarks(raw, node.marks);
    }

    case 'hardBreak':
      return '\n';

    case 'bulletList':
      return renderList(node, '-');

    case 'orderedList':
      return renderList(node, '1.');

    case 'listItem':
      // Standalone listItem (should normally be within a list)
      return renderListItem(node, '- ');

    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = (node.content || [])
        .map((n) => n.text || '')
        .join('');
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case 'blockquote': {
      const inner = renderNodes(node.content || []).trim();
      const quoted = inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return quoted + '\n\n';
    }

    case 'rule':
      return '---\n\n';

    case 'table':
      return renderTable(node);

    case 'tableRow':
    case 'tableHeader':
    case 'tableCell':
      // Rendered via renderTable
      return renderNodes(node.content || []);

    case 'mediaSingle': {
      const media = (node.content || []).find((n) => n.type === 'media');
      if (media) return renderNode(media);
      return '';
    }

    case 'media': {
      const url = node.attrs?.url || node.attrs?.id || '';
      const alt = node.attrs?.alt || 'image';
      return `![${alt}](${url})\n\n`;
    }

    case 'inlineCard': {
      const url = node.attrs?.url || '';
      return `[${url}](${url})`;
    }

    case 'mention': {
      const name =
        node.attrs?.text ||
        node.attrs?.displayName ||
        node.attrs?.id ||
        'unknown';
      const cleanName = name.startsWith('@') ? name : `@${name}`;
      return cleanName;
    }

    case 'emoji': {
      return node.attrs?.text || node.attrs?.shortName || '';
    }

    case 'panel': {
      const panelType = node.attrs?.panelType || 'info';
      const emojiMap = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '🚫',
        success: '✅',
        note: '📝',
      };
      const emoji = emojiMap[panelType] || 'ℹ️';
      const inner = renderNodes(node.content || []).trim();
      const prefixed = `${emoji} ${inner}`;
      const quoted = prefixed
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return quoted + '\n\n';
    }

    default:
      // Attempt to render children for unknown node types
      if (node.content) {
        return renderNodes(node.content);
      }
      return '';
  }
}

/**
 * Render an array of ADF nodes.
 * @param {Array} nodes
 * @returns {string}
 */
function renderNodes(nodes) {
  if (!nodes || nodes.length === 0) return '';
  return nodes.map(renderNode).join('');
}

/**
 * Convert an Atlassian Document Format (ADF) JSON object to Markdown.
 * @param {object|null|undefined} adf - ADF document root
 * @returns {string} Markdown string
 */
export function adfToMarkdown(adf) {
  if (!adf) return '';

  const result = renderNode(adf);
  // Trim trailing whitespace/newlines for clean output
  return result.trimEnd();
}
