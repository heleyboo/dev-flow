// Phase 2: Figma API integration
// Spec: docs/03-FIGMA-INTEGRATION.md

import { promises as fs } from 'fs';
import { join } from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Pure exported functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse a Figma URL into { fileKey, nodeId, type }.
 * Supports: /file/, /design/, /proto/, /board/
 *
 * @param {string} url
 * @returns {{ fileKey: string, nodeId: string|null, type: 'file'|'design'|'proto'|'board' }}
 */
export function parseFigmaUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid Figma URL: ${url}`);
  }

  const pattern = /figma\.com\/(file|design|proto|board)\/([A-Za-z0-9_-]+)/;
  const match = url.match(pattern);

  if (!match) {
    throw new Error(`Could not parse Figma URL: ${url}`);
  }

  const type = match[1];
  const fileKey = match[2];

  // Extract node-id from query string (format: 456:789 or 456-789)
  let nodeId = null;
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const rawNodeId = urlObj.searchParams.get('node-id');
    if (rawNodeId) {
      // Normalize: replace hyphens with colons for consistency
      nodeId = rawNodeId.replace(/-/g, ':');
    }
  } catch {
    // If URL parsing fails, try regex
    const nodeMatch = url.match(/[?&]node-id=([^&]+)/);
    if (nodeMatch) {
      nodeId = decodeURIComponent(nodeMatch[1]).replace(/-/g, ':');
    }
  }

  return { fileKey, nodeId, type };
}

/**
 * Sanitize a UI label into a snake_case field name.
 * - Removes action prefixes: upload, select, choose, enter, input
 * - Removes parenthetical notes
 * - Removes special chars
 * - Lowercases and replaces spaces with underscores
 *
 * @param {string} label
 * @returns {string}
 */
export function sanitizeFieldName(label) {
  if (!label || typeof label !== 'string') return '';

  let name = label.trim();

  // Remove parenthetical notes like "(Optional)", "(Required)"
  name = name.replace(/\s*\([^)]*\)/g, '');

  // Remove action prefixes (case-insensitive)
  name = name.replace(/^(upload|select|choose|enter|input)\s+/i, '');

  // Remove special characters except spaces
  name = name.replace(/[^a-zA-Z0-9\s]/g, '');

  // Lowercase
  name = name.toLowerCase().trim();

  // Replace spaces with underscores
  name = name.replace(/\s+/g, '_');

  return name;
}

/**
 * Infer the UI element type from a Figma node.
 *
 * @param {{ name: string, type?: string, fills?: any[], strokes?: any[], children?: any[], cornerRadius?: number }} node
 * @returns {'button'|'input'|'select'|'checkbox'|'avatar'|'card'|'table'|'form'|'image'|null}
 */
export function inferUIElement(node) {
  if (!node) return null;

  const name = (node.name ?? '').toLowerCase();
  const children = node.children ?? [];

  // Checkbox: name contains checkbox/check
  if (/checkbox|check/.test(name)) return 'checkbox';

  // Avatar: name contains avatar/profile pic, or circle with image fill
  if (/avatar|profile[\s_-]?pic/.test(name)) return 'avatar';

  // Table: name contains table/grid
  if (/table|grid/.test(name)) return 'table';

  // Select/Dropdown: name contains select/dropdown, or input-like with arrow child
  if (/select|dropdown/.test(name)) return 'select';

  // Check for select by structure: has children with arrow indicator
  const hasArrowChild = children.some((c) => {
    const cn = (c.name ?? '').toLowerCase();
    return /arrow|chevron|caret/.test(cn);
  });
  if (hasArrowChild && /input|field|textfield/.test(name)) return 'select';

  // Button: name contains button/btn/cta, or has fill + text + corner radius
  if (/\b(button|btn|cta)\b/.test(name)) return 'button';

  // Button by structure: has fills, has text child, has corner radius
  const hasFills = Array.isArray(node.fills) && node.fills.length > 0;
  const hasTextChild = children.some((c) => c.type === 'TEXT');
  const hasCornerRadius = node.cornerRadius != null && node.cornerRadius > 0;
  if (hasFills && hasTextChild && hasCornerRadius) return 'button';

  // Input: name contains input/field/textfield, or rectangle with border
  if (/input|field|textfield/.test(name)) return 'input';

  // Input by structure: rectangle with strokes (border)
  const hasStrokes = Array.isArray(node.strokes) && node.strokes.length > 0;
  if ((node.type === 'RECTANGLE' || node.type === 'FRAME') && hasStrokes) return 'input';

  // Form: name contains form, or frame with multiple input children
  if (/form/.test(name)) return 'form';

  // Form by structure: frame with multiple input-like children
  const inputChildCount = children.filter((c) => {
    const cn = (c.name ?? '').toLowerCase();
    return /input|field|textfield|select|dropdown/.test(cn);
  }).length;
  if (inputChildCount >= 2) return 'form';

  // Card: name contains card
  if (/card/.test(name)) return 'card';

  // Image: name contains image/img/photo/banner
  if (/image|img|photo|banner/.test(name)) return 'image';

  return null;
}

/**
 * Convert an RGBA color object to a hex string.
 * @param {{ r: number, g: number, b: number, a?: number }} color
 * @returns {string}
 */
function rgbaToHex({ r, g, b }) {
  const toHex = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Classify a color by its name or hex value.
 * @param {string} name
 * @param {string} hex
 * @returns {string}
 */
function classifyColor(name, hex) {
  const n = name.toLowerCase();
  if (/primary|brand|accent/.test(n)) return 'primary';
  if (/secondary/.test(n)) return 'secondary';
  if (/text|label|heading|title/.test(n)) return 'text';
  if (/background|bg|surface|base/.test(n)) return 'background';
  if (/border|stroke|outline|divider/.test(n)) return 'border';
  if (/error|danger|warning|alert/.test(n)) return 'error';

  // Classify by hex value heuristics
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness > 240) return 'background';
  if (brightness < 30) return 'text';

  return 'primary';
}

/**
 * Walk a Figma node tree, collect unique colors, typography, spacing, and border radii.
 *
 * @param {object[]} nodes  Array of Figma nodes to walk
 * @returns {{ colors: object[], typography: object[], spacing: number[], borderRadius: number[] }}
 */
export function extractDesignTokens(nodes) {
  const colorMap = new Map(); // hex -> { name, hex, usage }
  const typographySet = new Map(); // key -> { fontFamily, fontSize, fontWeight, lineHeight }
  const spacingSet = new Set();
  const borderRadiusSet = new Set();

  function walk(node) {
    if (!node) return;

    // Extract fills (colors)
    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = rgbaToHex(fill.color);
          if (!colorMap.has(hex)) {
            const usage = classifyColor(node.name ?? '', hex);
            colorMap.set(hex, { name: node.name ?? hex, hex, usage });
          }
        }
      }
    }

    // Extract typography from text nodes
    if (node.type === 'TEXT' && node.style) {
      const { fontFamily, fontSize, fontWeight, lineHeightPx } = node.style;
      const key = `${fontFamily}-${fontSize}-${fontWeight}`;
      if (!typographySet.has(key)) {
        typographySet.set(key, {
          fontFamily: fontFamily ?? null,
          fontSize: fontSize ?? null,
          fontWeight: fontWeight ?? null,
          lineHeight: lineHeightPx ?? null,
        });
      }
    }

    // Extract spacing from absoluteBoundingBox or padding
    if (node.paddingLeft != null) spacingSet.add(node.paddingLeft);
    if (node.paddingRight != null) spacingSet.add(node.paddingRight);
    if (node.paddingTop != null) spacingSet.add(node.paddingTop);
    if (node.paddingBottom != null) spacingSet.add(node.paddingBottom);
    if (node.itemSpacing != null) spacingSet.add(node.itemSpacing);

    // Extract border radius
    if (node.cornerRadius != null && node.cornerRadius > 0) {
      borderRadiusSet.add(node.cornerRadius);
    }

    // Recurse into children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of nodeArray) {
    walk(node);
  }

  return {
    colors: Array.from(colorMap.values()),
    typography: Array.from(typographySet.values()),
    spacing: Array.from(spacingSet).sort((a, b) => a - b),
    borderRadius: Array.from(borderRadiusSet).sort((a, b) => a - b),
  };
}

/**
 * Walk a Figma node tree looking for input/select/checkbox nodes,
 * and return extracted field objects.
 *
 * @param {object[]} nodes
 * @returns {object[]}
 */
export function extractImpliedFields(nodes) {
  const fields = [];

  function walk(node) {
    if (!node) return;

    const uiType = inferUIElement(node);

    if (uiType === 'input' || uiType === 'select' || uiType === 'checkbox') {
      const rawName = node.name ?? '';
      const sanitized = sanitizeFieldName(rawName);

      // Detect if required (name or placeholder contains asterisk)
      const hasAsterisk = rawName.includes('*');

      // Infer inputType
      let inputType = 'text';
      if (uiType === 'select') inputType = 'select';
      else if (uiType === 'checkbox') inputType = 'checkbox';
      else {
        const ln = rawName.toLowerCase();
        if (/email/.test(ln)) inputType = 'email';
        else if (/password|pass/.test(ln)) inputType = 'password';
        else if (/phone|tel/.test(ln)) inputType = 'tel';
        else if (/number|qty|quantity|amount/.test(ln)) inputType = 'number';
        else if (/date/.test(ln)) inputType = 'date';
        else if (/url|link|website/.test(ln)) inputType = 'url';
      }

      // Extract placeholder from children text nodes
      let placeholder = null;
      if (Array.isArray(node.children)) {
        const textChild = node.children.find((c) => c.type === 'TEXT');
        if (textChild && textChild.characters) {
          placeholder = textChild.characters;
        }
      }

      // Infer validation hints
      const validation = [];
      if (hasAsterisk) validation.push('required');
      if (inputType === 'email') validation.push('email');
      if (inputType === 'tel') validation.push('phone');
      if (inputType === 'url') validation.push('url');

      fields.push({
        name: sanitized,
        type: uiType,
        inputType,
        required: hasAsterisk,
        placeholder,
        validation,
      });
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of nodeArray) {
    walk(node);
  }

  return fields;
}

// ──────────────────────────────────────────────────────────────────────────────
// FigmaService class
// ──────────────────────────────────────────────────────────────────────────────

export class FigmaService {
  constructor() {
    this.token = process.env.DEVFLOW_FIGMA_TOKEN ?? '';
    this.headers = {
      'X-Figma-Token': this.token,
    };
    this.cacheDir = '.devflow/cache/figma';
    this.baseUrl = 'https://api.figma.com/v1';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cache helpers
  // ──────────────────────────────────────────────────────────────────────────

  async getCached(key) {
    try {
      const filePath = join(this.cacheDir, `${key}.json`);
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setCache(key, data) {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const filePath = join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify({ ...data, _cachedAt: Date.now() }), 'utf-8');
    } catch {
      // Cache write failure is non-fatal
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP helper
  // ──────────────────────────────────────────────────────────────────────────

  async _get(url) {
    const res = await fetch(url, { headers: this.headers });

    if (res.status === 403) {
      throw new Error(
        `Figma API returned 403 Forbidden. ` +
          `Please check that DEVFLOW_FIGMA_TOKEN is set correctly.`
      );
    }

    if (res.status === 404) {
      throw new Error(`Figma API returned 404 Not Found for: ${url}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Figma API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fetch a Figma file by key. Checks cache first.
   * @param {string} fileKey
   */
  async getFile(fileKey) {
    const cacheKey = `file-${fileKey}`;
    const cached = await this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${this.baseUrl}/files/${fileKey}`;
    const data = await this._get(url);

    await this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Fetch specific nodes from a Figma file.
   * @param {string} fileKey
   * @param {string[]} nodeIds
   */
  async getNodes(fileKey, nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds.join(',') : nodeIds;
    const url = `${this.baseUrl}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`;
    const data = await this._get(url);
    return data.nodes ?? {};
  }

  /**
   * Fetch image exports for nodes.
   * @param {string} fileKey
   * @param {string[]} nodeIds
   * @param {string} format
   */
  async getImages(fileKey, nodeIds, format = 'png') {
    const ids = Array.isArray(nodeIds) ? nodeIds.join(',') : nodeIds;
    const url = `${this.baseUrl}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}`;
    const data = await this._get(url);
    return data.images ?? {};
  }

  /**
   * Extract full specs from a Figma URL or file key.
   * @param {string} urlOrFileKey
   * @param {{ depth?: number }} options
   */
  async extractSpecs(urlOrFileKey, options = {}) {
    let fileKey = urlOrFileKey;
    let nodeId = null;
    let type = 'file';

    // Detect if it's a URL
    if (urlOrFileKey.includes('figma.com')) {
      const parsed = parseFigmaUrl(urlOrFileKey);
      fileKey = parsed.fileKey;
      nodeId = parsed.nodeId;
      type = parsed.type;
    }

    const maxDepth = options.depth ?? 3;

    let document;
    let name;

    if (nodeId) {
      const nodesData = await this.getNodes(fileKey, [nodeId]);
      const nodeData = nodesData[nodeId];
      document = nodeData?.document ?? null;
      name = document?.name ?? fileKey;
    } else {
      const fileData = await this.getFile(fileKey);
      document = fileData?.document ?? null;
      name = fileData?.name ?? fileKey;
    }

    // Build component tree
    const componentTree = document
      ? this.buildComponentTree(document, 0, maxDepth)
      : null;

    // Collect all nodes for token/field extraction
    const allNodes = document ? [document] : [];

    // Extract design tokens and implied fields
    const tokens = extractDesignTokens(allNodes);
    const fields = extractImpliedFields(allNodes);

    return {
      fileKey,
      nodeId,
      type,
      name,
      componentTree,
      designTokens: tokens,
      impliedFields: fields,
    };
  }

  /**
   * Recursively build a component tree from Figma nodes.
   * @param {object} node
   * @param {number} depth
   * @param {number} maxDepth
   * @returns {object}
   */
  buildComponentTree(node, depth, maxDepth) {
    if (!node) return null;

    const uiType = inferUIElement(node);

    const componentNode = {
      id: node.id ?? null,
      name: node.name ?? '',
      type: node.type ?? null,
      uiElement: uiType,
      depth,
    };

    if (depth < maxDepth && Array.isArray(node.children) && node.children.length > 0) {
      componentNode.children = node.children.map((child) =>
        this.buildComponentTree(child, depth + 1, maxDepth)
      );
    } else {
      componentNode.children = [];
    }

    return componentNode;
  }
}
