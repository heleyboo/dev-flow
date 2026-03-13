// Phase 1: Jira API integration
// Spec: docs/02-JIRA-INTEGRATION.md

import { apiRequest } from '../utils/api-client.js';
import { loadConfig } from '../utils/config.js';

export class JiraService {
  constructor() {
    this.config = loadConfig();
  }

  // TODO: Implement per docs/02-JIRA-INTEGRATION.md
  // - getIssue(key)
  // - listMyTasks(filters)
  // - transitionIssue(key, status)
  // - addComment(key, body)
  // - parseADF(adfContent) -> markdown
  // - extractAcceptanceCriteria(description)
  // - extractLinks(issue) -> figmaLinks, srsReferences
}
