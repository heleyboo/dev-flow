// Phase 3: Prompt generation engine
// Spec: docs/04-PROMPT-GENERATION.md + docs/09-FRONTEND-SUPPORT.md

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers to locate this file's directory
// ──────────────────────────────────────────────────────────────────────────────

function getDirname() {
  try {
    return fileURLToPath(new URL('.', import.meta.url));
  } catch {
    return process.cwd();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Stop words for keyword extraction
// ──────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'it', 'its', 'was', 'are',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this',
  'that', 'these', 'those', 'i', 'we', 'you', 'he', 'she', 'they',
  'not', 'no', 'so', 'if', 'then', 'than', 'when', 'where', 'which',
  'who', 'how', 'what', 'all', 'also', 'into', 'up', 'out', 'about',
  'after', 'before', 'between', 'through', 'during', 'need', 'needs',
  'should', 'must', 'need', 'want', 'make', 'use', 'used', 'using',
]);

// ──────────────────────────────────────────────────────────────────────────────
// Pure exported functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Select the appropriate template name for a task.
 * @param {{ type: string, summary: string, description: string }} task
 * @returns {string}
 */
export function selectTemplate(task) {
  const type = (task.type ?? '').toLowerCase();
  const text = `${task.summary ?? ''} ${task.description ?? ''}`.toLowerCase();

  // Bug type or bug keywords
  if (type === 'bug' || /\b(bug|fix|error|broken|crash|failure|issue|defect)\b/.test(text)) {
    return 'bug-fix';
  }

  // Migration keywords
  if (/\b(migrat|migration|schema|database\s+change|db\s+change|alter\s+table|add\s+column|rename\s+column)\b/.test(text)) {
    return 'migration';
  }

  // Refactor keywords
  if (/\b(refactor|cleanup|clean\s+up|restructure|reorganize|rewrite|improve\s+code|technical\s+debt)\b/.test(text)) {
    return 'refactor';
  }

  // Integration keywords
  if (/\b(integrat|webhook|oauth|third.party|stripe|paypal|twilio|sendgrid|aws|s3|sqs|sns|firebase|pusher|slack|api\s+integration)\b/.test(text)) {
    return 'integration';
  }

  // CRUD keywords
  if (/\b(crud|list|create|read|update|delete|resource|model|repository|repository)\b/.test(text) &&
      !/\b(endpoint|route|api)\b/.test(text)) {
    return 'crud-feature';
  }

  // API/endpoint keywords
  if (/\b(api|endpoint|route|controller|request|response|rest|graphql)\b/.test(text)) {
    return 'api-endpoint';
  }

  // Story type default
  if (type === 'story') {
    return 'api-endpoint';
  }

  // Fallback
  return 'api-endpoint';
}

/**
 * Extract meaningful keywords from a task's summary and description.
 * @param {{ summary: string, description: string }} task
 * @returns {string[]}
 */
export function extractKeywords(task) {
  const text = `${task.summary ?? ''} ${task.description ?? ''}`;

  // Split on non-alphanumeric characters
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Deduplicate
  return [...new Set(words)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Language detection helper
// ──────────────────────────────────────────────────────────────────────────────

function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.php': 'php',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.md': 'markdown',
  };
  return map[ext] ?? 'text';
}

// ──────────────────────────────────────────────────────────────────────────────
// Recursive file scan helper
// ──────────────────────────────────────────────────────────────────────────────

function walkDir(dir, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return [];
  let results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walkDir(fullPath, depth + 1, maxDepth));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory unreadable — skip
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// PromptService
// ──────────────────────────────────────────────────────────────────────────────

export class PromptService {
  constructor(config) {
    this.config = config ?? {};
    this._hbs = Handlebars.create();

    // Register add1 helper for 1-based indexing
    this._hbs.registerHelper('add1', (val) => val + 1);

    // Locate templates directory relative to this file
    const serviceDir = getDirname();
    this._templatesDir = join(serviceDir, '..', 'templates');
    this._partialsDir = join(this._templatesDir, 'partials');

    // Register built-in partials
    this._registerPartials(this._partialsDir);

    // Load base template source (lazy: compiled on use in renderTemplate)
    this._baseTemplateSrc = null;
    this._loadBaseTemplate();
  }

  _loadBaseTemplate() {
    try {
      const basePath = join(this._templatesDir, 'base.hbs');
      this._baseTemplateSrc = readFileSync(basePath, 'utf-8');
    } catch {
      this._baseTemplateSrc = '';
    }
  }

  _registerPartials(partialsDir) {
    try {
      const entries = readdirSync(partialsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.hbs')) {
          const name = basename(entry.name, '.hbs');
          const content = readFileSync(join(partialsDir, entry.name), 'utf-8');
          this._hbs.registerPartial(name, content);
        }
      }
    } catch {
      // Partials directory missing — skip
    }
  }

  /**
   * Render a named template partial using the base template.
   * @param {string} templateName
   * @param {object} data
   * @returns {string}
   */
  renderTemplate(templateName, data) {
    const compiled = this._hbs.compile(this._baseTemplateSrc);
    const renderData = { ...data, templatePartial: templateName };
    return compiled(renderData);
  }

  /**
   * Scan the codebase for files related to given keywords.
   * @param {string[]} keywords
   * @returns {{ files: Array<{path: string, content: string, language: string}>, routes: string[], models: string[], dbSchema: string[] }}
   */
  scanCodebase(keywords) {
    const searchDirs = [
      'src',
      'app/Http/Controllers',
      'app/Http/Requests',
      'app/Services',
      'app/Models',
      'app/Repositories',
      'database/migrations',
      'routes',
      'tests',
      'config',
    ];

    const cwd = process.cwd();
    const lowerKeywords = (keywords ?? []).map((k) => k.toLowerCase());

    const matchingFiles = [];

    for (const dir of searchDirs) {
      const absDir = join(cwd, dir);
      if (!existsSync(absDir)) continue;
      const files = walkDir(absDir);
      for (const filePath of files) {
        const relPath = filePath.replace(cwd + '/', '');
        const fileNameLower = basename(filePath).toLowerCase();
        const matches = lowerKeywords.some((kw) => fileNameLower.includes(kw));
        if (matches) {
          matchingFiles.push(filePath);
        }
      }
    }

    const files = matchingFiles.map((filePath) => {
      let content = '';
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const lines = raw.split('\n');
        content = lines.slice(0, 200).join('\n');
      } catch {
        content = '';
      }
      return {
        path: filePath.replace(cwd + '/', ''),
        content,
        language: detectLanguage(filePath),
      };
    });

    return {
      files,
      routes: [],
      models: [],
      dbSchema: [],
    };
  }

  /**
   * List available templates (built-in + custom).
   * @returns {Array<{name: string, description: string, builtin: boolean}>}
   */
  listTemplates() {
    const templates = [];

    // Built-in templates
    try {
      const entries = readdirSync(this._partialsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.hbs')) {
          const name = basename(entry.name, '.hbs');
          templates.push({
            name,
            description: `Built-in template: ${name}`,
            builtin: true,
          });
        }
      }
    } catch {
      // Partials directory missing
    }

    // Custom templates from .devflow/templates/
    const customDir = join(process.cwd(), '.devflow', 'templates');
    if (existsSync(customDir)) {
      try {
        const entries = readdirSync(customDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.hbs')) {
            const name = basename(entry.name, '.hbs');
            templates.push({
              name,
              description: `Custom template: ${name}`,
              builtin: false,
            });
          }
        }
      } catch {
        // Custom directory unreadable
      }
    }

    return templates;
  }

  /**
   * Generate a full prompt for a task.
   * @param {object} task
   * @param {{ noFigma?: boolean, noCodeContext?: boolean, template?: string }} options
   * @returns {Promise<string>}
   */
  async generatePrompt(task, options = {}) {
    const templateName = options.template ?? selectTemplate(task);
    const keywords = extractKeywords(task);

    // Get figma specs if task has figmaLinks and NOT options.noFigma
    let figmaData = null;
    if (task.figmaLinks && task.figmaLinks.length > 0 && !options.noFigma) {
      try {
        const { FigmaService } = await import('./figma.service.js');
        const figmaService = new FigmaService(this.config);
        const specs = await figmaService.extractSpecs(task.figmaLinks[0]);

        // Build component tree markdown
        let componentTreeMarkdown = '';
        if (specs.componentTree) {
          componentTreeMarkdown = this._renderComponentTree(specs.componentTree, 0);
        }

        figmaData = {
          ...specs,
          componentTreeMarkdown,
        };
      } catch {
        figmaData = null;
      }
    }

    // Get code context if NOT options.noCodeContext
    let codeContext = null;
    if (!options.noCodeContext) {
      const scanned = this.scanCodebase(keywords);
      if (scanned.files.length > 0) {
        codeContext = scanned;
      }
    }

    // Build template data
    const data = {
      task: {
        key: task.key ?? '',
        summary: task.summary ?? '',
        description: task.description ?? '',
        type: task.type ?? '',
        priority: task.priority ?? '',
        status: task.status ?? '',
        sprint: task.sprint ?? null,
        epic: task.epic ?? null,
        parent: task.parent ?? null,
        subtasks: task.subtasks ?? [],
        acceptanceCriteria: task.acceptanceCriteria ?? [],
        figmaLinks: task.figmaLinks ?? [],
        labels: task.labels ?? [],
      },
      figma: figmaData,
      codeContext,
      standards: this.config.standards ?? [],
    };

    // Render
    const rendered = this.renderTemplate(templateName, data);

    // Save to .devflow/prompts/{task.key}.md
    if (task.key) {
      try {
        const promptsDir = join(process.cwd(), '.devflow', 'prompts');
        mkdirSync(promptsDir, { recursive: true });
        writeFileSync(join(promptsDir, `${task.key}.md`), rendered, 'utf-8');
      } catch {
        // Non-fatal — prompt still returned
      }
    }

    return rendered;
  }

  /**
   * Recursively render a component tree to markdown.
   * @param {object} node
   * @param {number} depth
   * @returns {string}
   */
  _renderComponentTree(node, depth) {
    if (!node) return '';
    const indent = '  '.repeat(depth);
    const uiLabel = node.uiElement ? ` [${node.uiElement}]` : '';
    let result = `${indent}- ${node.name}${uiLabel}\n`;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        result += this._renderComponentTree(child, depth + 1);
      }
    }
    return result;
  }
}
