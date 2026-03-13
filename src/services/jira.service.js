// Phase 1: Jira API integration
// Spec: docs/02-JIRA-INTEGRATION.md

import { loadConfig } from '../utils/config.js';
import { adfToMarkdown } from '../parsers/adf-parser.js';
import {
  extractFigmaLinks,
  extractSrsReferences,
  extractAcceptanceCriteria,
} from '../parsers/link-extractor.js';

export class JiraService {
  constructor(config) {
    this.config = config ?? loadConfig();

    const jira = this.config?.jira ?? {};
    this.host = jira.host ?? '';
    this.email = jira.email ?? '';
    this.projectKey = jira.project_key ?? '';
    this.storyPointsField = jira.story_points_field ?? 'customfield_10016';
    this.customFieldsConfig = jira.custom_fields ?? {};

    const token = process.env.DEVFLOW_JIRA_TOKEN ?? '';
    this.authHeader = `Basic ${Buffer.from(`${this.email}:${token}`).toString('base64')}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Core HTTP helpers
  // ──────────────────────────────────────────────────────────────────────────

  _headers() {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async _get(path) {
    const url = `${this.host}${path}`;
    const res = await fetch(url, { headers: this._headers() });

    if (res.status === 401) {
      throw new Error(
        `Jira API returned 401 Unauthorized. ` +
          `Please check that DEVFLOW_JIRA_TOKEN is set correctly.`
      );
    }

    if (res.status === 404) {
      throw new Error(
        `Jira API returned 404 Not Found for path: ${path}`
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Jira API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async _post(path, body) {
    const url = `${this.host}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Jira API POST error ${res.status}: ${text}`);
    }

    // Some endpoints return 204 No Content
    const ct = res.headers.get('content-type') ?? '';
    if (res.status === 204 || !ct.includes('application/json')) {
      return null;
    }

    return res.json();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fetch a single Jira issue and return a ParsedTask.
   * @param {string} issueKey
   */
  async getIssue(issueKey) {
    const data = await this._get(`/rest/api/3/issue/${issueKey}`);
    return this.parseIssue(data);
  }

  /**
   * Search issues with a JQL query.
   * Returns compact result objects.
   * @param {string} jql
   */
  async searchIssues(jql) {
    const data = await this._post('/rest/api/3/search', {
      jql,
      maxResults: 100,
      fields: ['summary', 'status', 'priority', 'issuetype', 'assignee'],
    });

    const issues = data?.issues ?? [];
    return issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      status: issue.fields?.status?.name ?? '',
      priority: issue.fields?.priority?.name?.toLowerCase() ?? '',
      type: issue.fields?.issuetype?.name?.toLowerCase() ?? '',
      assignee: issue.fields?.assignee?.displayName ?? issue.fields?.assignee?.emailAddress ?? null,
    }));
  }

  /**
   * List tasks assigned to the current user, with optional filters.
   * @param {{ status?: string, sprint?: string, priority?: string }} filters
   */
  async listMyTasks(filters = {}) {
    const statusMap = {
      todo: 'To Do',
      inprogress: 'In Progress',
      review: 'In Review',
      done: 'Done',
    };

    const conditions = ['assignee = currentUser()'];

    if (this.projectKey) {
      conditions.push(`project = "${this.projectKey}"`);
    }

    if (filters.status) {
      const mapped = statusMap[filters.status] ?? filters.status;
      conditions.push(`status = "${mapped}"`);
    }

    if (filters.sprint) {
      conditions.push(`sprint = "${filters.sprint}"`);
    }

    if (filters.priority) {
      const priorityName =
        filters.priority.charAt(0).toUpperCase() + filters.priority.slice(1).toLowerCase();
      conditions.push(`priority = "${priorityName}"`);
    }

    const jql = conditions.join(' AND ');
    return this.searchIssues(jql);
  }

  /**
   * Transition an issue to a new status by transition name.
   * @param {string} issueKey
   * @param {string} transitionName  e.g. "In Progress"
   */
  async transitionIssue(issueKey, transitionName) {
    const data = await this._get(`/rest/api/3/issue/${issueKey}/transitions`);
    const transitions = data?.transitions ?? [];

    const found = transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase()
    );

    if (!found) {
      const available = transitions.map((t) => t.name).join(', ');
      throw new Error(
        `Transition "${transitionName}" not found for issue ${issueKey}. ` +
          `Available transitions: ${available}`
      );
    }

    await this._post(`/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: found.id },
    });

    return { success: true, transitionId: found.id, transitionName: found.name };
  }

  /**
   * Add a plain-text comment to an issue (wrapped in ADF format).
   * @param {string} issueKey
   * @param {string} body
   */
  async addComment(issueKey, body) {
    const adfBody = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: body,
            },
          ],
        },
      ],
    };

    return this._post(`/rest/api/3/issue/${issueKey}/comment`, { body: adfBody });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Parsing helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Convert raw Jira API response to a ParsedTask.
   * @param {object} data  Raw Jira issue response
   */
  parseIssue(data) {
    const fields = data.fields ?? {};

    // Description
    const descriptionMd = adfToMarkdown(fields.description ?? null);

    // Build text corpus for link extraction (description + custom field values)
    let corpus = descriptionMd;
    for (const [, fieldKey] of Object.entries(this.customFieldsConfig)) {
      const val = fields[fieldKey];
      if (typeof val === 'string') corpus += '\n' + val;
    }

    const figmaLinks = extractFigmaLinks(corpus);
    const srsReferences = extractSrsReferences(corpus);
    const acceptanceCriteria = extractAcceptanceCriteria(descriptionMd);

    // Sprint — stored in array of sprint objects (Jira cloud)
    const sprintField = fields['customfield_10020'];
    let sprint = null;
    if (Array.isArray(sprintField) && sprintField.length > 0) {
      sprint = sprintField[sprintField.length - 1]?.name ?? null;
    } else if (sprintField && typeof sprintField === 'object') {
      sprint = sprintField.name ?? null;
    }

    // Story points
    const storyPoints = fields[this.storyPointsField] ?? null;

    // Epic
    let epic = null;
    if (fields.epic) {
      epic = { key: fields.epic.key, summary: fields.epic.summary ?? fields.epic.fields?.summary ?? '' };
    } else if (fields.customfield_10014) {
      // Epic link (classic projects)
      epic = { key: fields.customfield_10014, summary: '' };
    }

    // Parent
    let parent = null;
    if (fields.parent) {
      parent = {
        key: fields.parent.key,
        summary: fields.parent.fields?.summary ?? '',
      };
    }

    // Subtasks
    const subtasks = (fields.subtasks ?? []).map((st) => ({
      key: st.key,
      summary: st.fields?.summary ?? '',
      status: st.fields?.status?.name ?? '',
    }));

    // Linked issues
    const linkedIssues = (fields.issuelinks ?? []).map((link) => {
      const outward = !!link.outwardIssue;
      const linked = outward ? link.outwardIssue : link.inwardIssue;
      const type = outward
        ? (link.type?.outward ?? link.type?.name ?? '')
        : (link.type?.inward ?? link.type?.name ?? '');
      return {
        type,
        key: linked?.key ?? '',
        summary: linked?.fields?.summary ?? '',
        status: linked?.fields?.status?.name ?? '',
      };
    });

    // Comments
    const rawComments = fields.comment?.comments ?? [];
    const comments = rawComments.map((c) => ({
      author: c.author?.displayName ?? c.author?.emailAddress ?? '',
      body: adfToMarkdown(c.body ?? null),
      created: c.created ?? '',
    }));

    // Custom fields
    const customFields = {};
    for (const [label, fieldKey] of Object.entries(this.customFieldsConfig)) {
      customFields[label] = fields[fieldKey] ?? null;
    }

    return {
      key: data.key,
      summary: fields.summary ?? '',
      description: descriptionMd,
      type: (fields.issuetype?.name ?? '').toLowerCase(),
      priority: (fields.priority?.name ?? '').toLowerCase(),
      status: fields.status?.name ?? '',
      assignee: fields.assignee?.displayName ?? fields.assignee?.emailAddress ?? null,
      reporter: fields.reporter?.displayName ?? fields.reporter?.emailAddress ?? null,
      sprint,
      storyPoints,
      epic,
      parent,
      subtasks,
      figmaLinks,
      srsReferences,
      linkedIssues,
      acceptanceCriteria,
      labels: fields.labels ?? [],
      components: (fields.components ?? []).map((c) => c.name),
      fixVersions: (fields.fixVersions ?? []).map((v) => v.name),
      comments,
      customFields,
      _raw: data,
    };
  }
}
