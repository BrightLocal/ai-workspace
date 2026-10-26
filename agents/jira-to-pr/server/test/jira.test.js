'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createJiraClient, JiraError } = require('../poller/jira');
const { adfToText } = require('../poller/marker');

const AUTH = 'Basic ' + Buffer.from('me@x.com:tok').toString('base64');

function fake(status, json) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof json === 'string' ? json : JSON.stringify(json ?? {})),
      json: async () => json,
    };
  };
  const client = createJiraClient({ baseUrl: 'https://j.example.com', email: 'me@x.com', token: 'tok', fetchImpl });
  return { calls, client };
}

test('search posts jql to search/jql and maps issues', async () => {
  const { calls, client } = fake(200, {
    issues: [{ key: 'LM-1', fields: { labels: ['AI'], updated: '2026-10-26T10:00:00.000+0000', summary: 's' } }],
  });
  const out = await client.search('project = LM');
  assert.equal(calls[0].url, 'https://j.example.com/rest/api/3/search/jql');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers.Authorization, AUTH);
  assert.deepEqual(JSON.parse(calls[0].opts.body), {
    jql: 'project = LM', fields: ['summary', 'labels', 'updated'], maxResults: 50,
  });
  assert.deepEqual(out, [{ key: 'LM-1', labels: ['AI'], updated: '2026-10-26T10:00:00.000+0000' }]);
});

test('setAiLabel sends remove and add in one PUT', async () => {
  const { calls, client } = fake(204, '');
  await client.setAiLabel('LM-1', 'AI', 'AI-Working');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://j.example.com/rest/api/3/issue/LM-1');
  assert.equal(calls[0].opts.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].opts.body), {
    update: { labels: [{ remove: 'AI' }, { add: 'AI-Working' }] },
  });
});

test('setAiLabel omits remove when from is null', async () => {
  const { calls, client } = fake(204, '');
  await client.setAiLabel('LM-1', null, 'AI');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { update: { labels: [{ add: 'AI' }] } });
});

test('comment wraps text with marker as ADF', async () => {
  const { calls, client } = fake(201, { id: '99' });
  const res = await client.comment('LM-1', 'hi', 'r1');
  assert.equal(res.id, '99');
  assert.equal(calls[0].url, 'https://j.example.com/rest/api/3/issue/LM-1/comment');
  assert.equal(calls[0].opts.method, 'POST');
  const body = JSON.parse(calls[0].opts.body).body;
  assert.equal(adfToText(body), '🤖 ai-workspace: hi\n[run:r1]');
});

test('getComments returns id, created, raw ADF body', async () => {
  const body = { type: 'doc', version: 1, content: [] };
  const { calls, client } = fake(200, { comments: [{ id: '1', created: 'c', body, author: {} }] });
  const out = await client.getComments('LM-1');
  assert.equal(calls[0].url, 'https://j.example.com/rest/api/3/issue/LM-1/comment?orderBy=created&maxResults=100');
  assert.equal(calls[0].opts.method, 'GET');
  assert.deepEqual(out, [{ id: '1', created: 'c', body }]);
});

test('non-2xx throws JiraError with status', async () => {
  const { client } = fake(403, 'nope');
  await assert.rejects(() => client.search('x'), (e) => {
    assert.ok(e instanceof JiraError);
    assert.equal(e.status, 403);
    assert.equal(e.body, 'nope');
    return true;
  });
});
