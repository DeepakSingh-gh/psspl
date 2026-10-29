import test from 'node:test';
import assert from 'node:assert/strict';
import { askAI, askClaude } from '../server/ai-provider.mjs';

test('Claude messages transport keeps keys private and never falls back to another vendor', async t => {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  t.after(() => { process.env = env; globalThis.fetch = originalFetch; });
  process.env.CRM_AI_PROVIDER = 'claude';
  process.env['Claude api key'] = 'synthetic-claude-key';
  delete process.env.ANTHROPIC_API_KEY; delete process.env.CLAUDE_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-unused-key';
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'synthetic-claude-key');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(init.body);
    assert.equal(body.system, 'system facts');
    assert.equal(body.messages[0].content, 'question');
    assert.ok(!init.body.includes('synthetic-claude-key'));
    return Response.json({ content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: 'Answer' }], stop_reason: 'end_turn' });
  };
  assert.equal(await askAI('system facts', 'question'), 'Answer');
  assert.equal(calls, 1);
  globalThis.fetch = async url => { assert.equal(url, 'https://api.anthropic.com/v1/messages'); return new Response('sensitive provider error', { status: 429 }); };
  await assert.rejects(askAI('system facts', 'question'), error => error.status === 503 && !error.message.includes('sensitive'));
  delete process.env['Claude api key'];
  globalThis.fetch = () => { throw Error('Unexpected network call'); };
  await assert.rejects(askClaude('system facts', 'question'), { status: 503 });
});
