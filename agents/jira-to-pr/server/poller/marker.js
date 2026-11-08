'use strict';

const MARKER = '🤖 ai-workspace:';

function markText(text, runId) {
  return `${MARKER} ${text}\n[run:${runId}]`;
}

const INLINE_LEAF = new Set(['text', 'mention', 'emoji', 'inlineCard', 'status', 'date']);

function nodeText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (INLINE_LEAF.has(node.type)) return node.attrs?.text || node.attrs?.shortName || '';
  const children = Array.isArray(node.content) ? node.content : [];
  if (node.type === 'doc') return joinBlocks(children);
  // A container whose children are all blocks (list, listItem, blockquote...) joins with \n;
  // a block holding inline nodes concatenates them.
  const hasBlockChild = children.some((c) => c && Array.isArray(c.content));
  return hasBlockChild ? joinBlocks(children) : children.map(nodeText).join('');
}

function joinBlocks(children) {
  return children.map(nodeText).join('\n');
}

function adfToText(adf) {
  if (typeof adf === 'string') return adf;
  return nodeText(adf);
}

function isAgentComment(body) {
  return adfToText(body).trimStart().startsWith(MARKER);
}

function textToAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: String(text).split('\n').map((line) => ({
      type: 'paragraph',
      content: line === '' ? [] : [{ type: 'text', text: line }],
    })),
  };
}

module.exports = { MARKER, markText, adfToText, isAgentComment, textToAdf };
