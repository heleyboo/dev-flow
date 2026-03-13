// Phase 2: Figma commands
// Spec: docs/03-FIGMA-INTEGRATION.md

import chalk from 'chalk';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';

import { FigmaService, parseFigmaUrl } from '../services/figma.service.js';
import { JiraService } from '../services/jira.service.js';
import { logger } from '../utils/logger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Render a component tree node using tree-drawing characters.
 * @param {object} node
 * @param {string} prefix
 * @param {boolean} isLast
 * @returns {string[]}
 */
function renderComponentTree(nodes, prefix = '', isRoot = true) {
  const lines = [];

  if (!nodes || nodes.length === 0) return lines;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└──' : '├──';
    const childPrefix = isLast ? prefix + '    ' : prefix + '│   ';

    const typeLabel = node.inferredType ? chalk.dim(` [${node.inferredType}]`) : '';
    const nodeType = node.type ? chalk.dim(` (${node.type})`) : '';
    lines.push(`${prefix}${connector} ${chalk.cyan(node.name)}${nodeType}${typeLabel}`);

    if (node.children && node.children.length > 0) {
      const childLines = renderComponentTree(node.children, childPrefix, false);
      lines.push(...childLines);
    }
  }

  return lines;
}

/**
 * Format specs as markdown string.
 * @param {object} specs
 * @returns {string}
 */
function formatMarkdown(specs) {
  const lines = [];

  // Header
  lines.push(`# Figma Specs: ${specs.fileName ?? specs.name ?? specs.fileKey}`);
  lines.push('');

  // Target node info
  if (specs.targetNode) {
    const node = specs.targetNode;
    lines.push(`**Node:** ${node.name}  |  **Type:** ${node.type}`);
    if (node.width != null && node.height != null) {
      lines.push(`**Size:** ${node.width} × ${node.height}`);
    }
    lines.push('');
  }

  // Component tree
  if (specs.componentTree && specs.componentTree.length > 0) {
    lines.push('## Component Tree');
    lines.push('');
    const treeLines = renderComponentTree(specs.componentTree);
    lines.push(...treeLines);
    lines.push('');
  }

  // Design tokens
  const tokens = specs.designTokens;
  if (tokens) {
    lines.push('## Design Tokens');
    lines.push('');

    if (tokens.colors && tokens.colors.length > 0) {
      lines.push('### Colors');
      for (const color of tokens.colors) {
        const usage = color.usage ? ` — ${color.usage}` : '';
        lines.push(`  - \`${color.hex}\` ${color.name}${usage}`);
      }
      lines.push('');
    }

    if (tokens.typography && tokens.typography.length > 0) {
      lines.push('### Typography');
      for (const t of tokens.typography) {
        const parts = [];
        if (t.fontFamily) parts.push(t.fontFamily);
        if (t.fontSize) parts.push(`${t.fontSize}px`);
        if (t.fontWeight) parts.push(`weight ${t.fontWeight}`);
        if (t.lineHeight) parts.push(`line-height ${t.lineHeight}`);
        lines.push(`  - ${parts.join(', ')}`);
      }
      lines.push('');
    }

    if (tokens.spacing && tokens.spacing.length > 0) {
      lines.push('### Spacing');
      lines.push(`  - ${tokens.spacing.join('px, ')}px`);
      lines.push('');
    }

    if (tokens.borderRadius && tokens.borderRadius.length > 0) {
      lines.push('### Border Radius');
      lines.push(`  - ${tokens.borderRadius.join('px, ')}px`);
      lines.push('');
    }
  }

  // Implied API fields
  if (specs.impliedFields && specs.impliedFields.length > 0) {
    lines.push('## Implied API Fields');
    lines.push('');
    for (const field of specs.impliedFields) {
      const req = field.required ? ' *(required)*' : '';
      const inputType = field.inputType ? ` \`${field.inputType}\`` : '';
      const type = field.type ? ` [${field.type}]` : '';
      lines.push(`  - **${field.name}**${req}${inputType}${type}`);
    }
    lines.push('');
  }

  // Responsive notes
  if (specs.responsiveBreakpoints && specs.responsiveBreakpoints.length > 0) {
    lines.push('## Responsive Breakpoints');
    lines.push('');
    for (const bp of specs.responsiveBreakpoints) {
      lines.push(`  - ${bp}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Display design tokens section only.
 * @param {object} specs
 */
function displayTokens(specs) {
  const tokens = specs.designTokens;
  if (!tokens) {
    logger.info('No design tokens found.');
    return;
  }

  console.log('');
  console.log(chalk.bold.cyan('Design Tokens'));
  console.log(chalk.dim('─'.repeat(50)));

  if (tokens.colors && tokens.colors.length > 0) {
    console.log('');
    console.log(chalk.bold('Colors:'));
    for (const color of tokens.colors) {
      const usage = color.usage ? chalk.dim(` (${color.usage})`) : '';
      console.log(`  ${chalk.yellow(color.hex)}  ${color.name}${usage}`);
    }
  }

  if (tokens.typography && tokens.typography.length > 0) {
    console.log('');
    console.log(chalk.bold('Typography:'));
    for (const t of tokens.typography) {
      const parts = [];
      if (t.fontFamily) parts.push(t.fontFamily);
      if (t.fontSize) parts.push(`${t.fontSize}px`);
      if (t.fontWeight) parts.push(`weight ${t.fontWeight}`);
      console.log(`  ${parts.join(', ')}`);
    }
  }

  if (tokens.spacing && tokens.spacing.length > 0) {
    console.log('');
    console.log(chalk.bold('Spacing:'));
    console.log(`  ${tokens.spacing.join('px, ')}px`);
  }

  if (tokens.borderRadius && tokens.borderRadius.length > 0) {
    console.log('');
    console.log(chalk.bold('Border Radius:'));
    console.log(`  ${tokens.borderRadius.join('px, ')}px`);
  }

  console.log('');
}

// ── figmaCommand ──────────────────────────────────────────────────────────────

export async function figmaCommand(urlOrJiraId, options = {}) {
  try {
    let figmaUrl;

    // 1. Determine if input is a Figma URL or Jira ID
    if (urlOrJiraId.startsWith('http')) {
      figmaUrl = urlOrJiraId;
    } else {
      // It's a Jira ID — look up Figma links from the task
      const jira = new JiraService();
      const task = await jira.getIssue(urlOrJiraId);

      if (!task.figmaLinks || task.figmaLinks.length === 0) {
        logger.error(`No Figma links found in ${urlOrJiraId}`);
        return;
      }

      figmaUrl = task.figmaLinks[0];
    }

    // 2. Create FigmaService and extract specs
    const figmaService = new FigmaService();
    const specs = await figmaService.extractSpecs(figmaUrl, {
      nodeId: options.node,
      depth: parseInt(options.depth) || 3,
    });

    // 3. If --tokens: only display design tokens and return
    if (options.tokens) {
      displayTokens(specs);
      return;
    }

    // 4. Format output based on options.format
    const format = options.format ?? 'md';
    let formatted;

    if (format === 'json') {
      formatted = JSON.stringify(specs, null, 2);
    } else if (format === 'yaml') {
      formatted = YAML.stringify(specs);
    } else {
      // Default: markdown
      formatted = formatMarkdown(specs);
    }

    // 5. If --save: write to file
    if (options.save) {
      const parsed = parseFigmaUrl(figmaUrl);
      const fileKey = parsed.fileKey ?? specs.fileKey ?? 'figma';
      const dir = resolve('.devflow/figma-specs');
      mkdirSync(dir, { recursive: true });
      const filePath = resolve(dir, `${fileKey}.${format}`);
      writeFileSync(filePath, formatted, 'utf-8');
      logger.success(`Saved to ${filePath}`);
    }

    // 6. Display formatted output
    console.log(formatted);
  } catch (err) {
    if (err.message && err.message.includes('403')) {
      logger.error('Figma API error: Check DEVFLOW_FIGMA_TOKEN');
    } else {
      logger.error(err.message);
    }
  }
}
