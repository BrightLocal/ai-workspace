'use strict';
const { markText, textToAdf } = require('./marker');

class JiraError extends Error {
  constructor(status, bodyText) {
    super(`Jira request failed: ${status} ${bodyText}`);
    this.name = 'JiraError';
    this.status = status;
    this.body = bodyText;
  }
}

function createJiraClient({ baseUrl, email, token, fetchImpl = fetch }) {
  const root = baseUrl.replace(/\/+$/, '');
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  async function request(method, path, body) {
    const headers = { Authorization: auth, Accept: 'application/json' };
    const opts = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetchImpl(`${root}${path}`, opts);
    const text = await res.text();
    if (!res.ok) throw new JiraError(res.status, text);
    return text ? JSON.parse(text) : null;
  }

  return {
    async search(jql, fields = ['summary', 'labels', 'updated']) {
      const data = await request('POST', '/rest/api/3/search/jql', { jql, fields, maxResults: 50 });
      return (data.issues || []).map((i) => ({
        key: i.key,
        labels: i.fields?.labels || [],
        updated: i.fields?.updated,
      }));
    },

    async setAiLabel(key, from, to) {
      const labels = [];
      if (from) labels.push({ remove: from });
      labels.push({ add: to });
      await request('PUT', `/rest/api/3/issue/${encodeURIComponent(key)}`, { update: { labels } });
    },

    async comment(key, text, runId) {
      const data = await request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
        body: textToAdf(markText(text, runId)),
      });
      return { id: data.id };
    },

    async getComments(key) {
      const data = await request(
        'GET',
        `/rest/api/3/issue/${encodeURIComponent(key)}/comment?orderBy=created&maxResults=100`,
      );
      return (data.comments || []).map((c) => ({ id: c.id, created: c.created, body: c.body }));
    },
  };
}

module.exports = { createJiraClient, JiraError };
