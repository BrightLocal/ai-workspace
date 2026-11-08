'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MARKER, markText, adfToText, isAgentComment, textToAdf } = require('../poller/marker');

const doc = (...paras) => ({
  type: 'doc',
  version: 1,
  content: paras.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

test('markText prefixes marker and appends run id', () => {
  assert.equal(markText('hello', 'r1'), '🤖 ai-workspace: hello\n[run:r1]');
  assert.equal(MARKER, '🤖 ai-workspace:');
});

test('isAgentComment detects marker inside ADF', () => {
  assert.equal(isAgentComment(doc('🤖 ai-workspace: question')), true);
  assert.equal(isAgentComment(doc('just a human reply')), false);
  assert.equal(isAgentComment('🤖 ai-workspace: question'), true);
  assert.equal(isAgentComment('  \n🤖 ai-workspace: q'), true);
  assert.equal(isAgentComment('plain'), false);
});

test('adfToText separates blocks with newline and handles hardBreak', () => {
  const adf = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'c' }, { type: 'hardBreak' }, { type: 'text', text: 'd' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'e' }] }] },
      ] },
    ],
  };
  assert.equal(adfToText(adf), 'ab\nc\nd\ne');
  assert.equal(adfToText('raw'), 'raw');
});

test('textToAdf makes one paragraph per line', () => {
  const adf = textToAdf('x\ny');
  assert.equal(adf.type, 'doc');
  assert.equal(adf.version, 1);
  assert.equal(adf.content.length, 2);
  assert.equal(adfToText(adf), 'x\ny');
});
