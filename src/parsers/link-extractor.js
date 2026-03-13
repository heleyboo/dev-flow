/**
 * Link extractor and acceptance criteria parser.
 * Extracts Figma URLs, SRS references, and acceptance criteria from text/markdown.
 */

/**
 * Extract Figma URLs from text.
 * Matches figma.com/file/*, figma.com/design/*, figma.com/proto/*, figma.com/board/*
 * Supports optional www. prefix. Returns deduplicated array.
 *
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
export function extractFigmaLinks(text) {
  if (!text) return [];

  const pattern =
    /https?:\/\/(?:www\.)?figma\.com\/(?:file|design|proto|board)\/[^\s"')>\]]+/gi;

  const matches = text.match(pattern);
  if (!matches) return [];

  // Deduplicate while preserving first-seen order
  return [...new Set(matches)];
}

/**
 * Extract SRS / requirement references from text.
 *
 * Matches:
 *   - "SRS Section 4.2", "SRS-Section 5.1", "SRS §4.2"
 *   - "REQ-4.2.1"
 *   - "requirement #AUTH-001", "req-AUTH-001"
 *
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
export function extractSrsReferences(text) {
  if (!text) return [];

  const patterns = [
    // SRS Section 4.2  |  SRS-Section 5.1
    /SRS[-\s]Section\s+[\d]+(?:\.[\d]+)*/gi,
    // SRS §4.2
    /SRS\s+§[\d]+(?:\.[\d]+)*/gi,
    // REQ-4.2.1  (word boundary at end to avoid consuming trailing punctuation)
    /REQ-[\w]+(?:\.[\w]+)*/gi,
    // requirement #AUTH-001
    /requirement\s+#[\w-]+/gi,
    // req-AUTH-001
    /\breq-[\w-]+/gi,
  ];

  const found = new Set();

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        // Strip trailing sentence-ending punctuation (. , ; !)
        found.add(m.trim().replace(/[.,;!]+$/, ''));
      }
    }
  }

  return [...found];
}

/**
 * Extract acceptance criteria items from a markdown string.
 *
 * Detection strategy:
 *  1. Look for an AC heading (## Acceptance Criteria, ## AC, ### AC:, etc.)
 *     then collect items until the next same-or-higher-level heading.
 *  2. Numbered list items:   "1. User can login"
 *  3. Checkbox list items:   "- [ ] Create endpoint", "- [x] Done"
 *  4. Given/When/Then blocks (collected as a single criterion entry)
 *  5. Fallback: inline "AC:" prefix
 *
 * @param {string|null|undefined} markdown
 * @returns {string[]}
 */
export function extractAcceptanceCriteria(markdown) {
  if (!markdown) return [];

  // ── Step 1: Try to locate an AC section heading ──────────────────────────
  // Heading pattern: one or more # characters followed by optional whitespace
  // then "Acceptance Criteria", "AC", "AC:" (case-insensitive)
  const headingRe =
    /^(#{1,6})\s+(?:Acceptance Criteria|AC:?)\s*$/im;

  const headingMatch = headingRe.exec(markdown);

  let sectionText = null;

  if (headingMatch) {
    const headingLevel = headingMatch[1].length; // number of '#'
    const afterHeading = markdown.slice(
      headingMatch.index + headingMatch[0].length
    );

    // Find the next heading of equal or higher level (fewer or equal #)
    const nextHeadingRe = new RegExp(
      `^#{1,${headingLevel}}\\s+`,
      'm'
    );
    const nextMatch = nextHeadingRe.exec(afterHeading);

    sectionText = nextMatch
      ? afterHeading.slice(0, nextMatch.index)
      : afterHeading;
  }

  if (sectionText !== null) {
    return parseCriteriaItems(sectionText);
  }

  // ── Step 2: Fallback — look for inline "AC:" prefix ──────────────────────
  const inlineAcRe = /^AC:\s*(.+)/im;
  const inlineMatch = inlineAcRe.exec(markdown);
  if (inlineMatch) {
    const value = inlineMatch[1].trim();
    return value ? [value] : [];
  }

  return [];
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse criteria items from the body text of an AC section.
 *
 * Recognises:
 *  - Numbered list:   "1. …"
 *  - Checkbox list:   "- [ ] …" or "- [x] …"
 *  - Given/When/Then: collected as a single block entry
 *
 * @param {string} text
 * @returns {string[]}
 */
function parseCriteriaItems(text) {
  const lines = text.split('\n');
  const criteria = [];

  // Given/When/Then accumulator
  let gwtBuffer = [];
  let insideGwt = false;

  const flushGwt = () => {
    if (gwtBuffer.length > 0) {
      criteria.push(gwtBuffer.join('\n').trim());
      gwtBuffer = [];
      insideGwt = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip blank lines but use them as GWT block separators
    if (line === '') {
      if (insideGwt) flushGwt();
      continue;
    }

    // Numbered list item: "1. text"
    const numberedMatch = /^\d+\.\s+(.+)/.exec(line);
    if (numberedMatch) {
      flushGwt();
      criteria.push(numberedMatch[1].trim());
      continue;
    }

    // Checkbox list item: "- [ ] text" or "- [x] text"
    const checkboxMatch = /^-\s+\[[ xX]\]\s+(.+)/.exec(line);
    if (checkboxMatch) {
      flushGwt();
      criteria.push(checkboxMatch[1].trim());
      continue;
    }

    // Given / When / Then
    if (/^(Given|When|Then)\b/i.test(line)) {
      insideGwt = true;
      gwtBuffer.push(line);
      continue;
    }

    // Continuation of a GWT block (indented or "And …")
    if (insideGwt && /^(And|But)\b/i.test(line)) {
      gwtBuffer.push(line);
      continue;
    }

    // Any other line ends a GWT block
    if (insideGwt) {
      flushGwt();
    }
  }

  // Flush any trailing GWT block
  flushGwt();

  return criteria;
}
