#!/usr/bin/env node

/**
 * Minimal Agent-Facing Client for Agent Bounty Feed
 * Zero-dependency Node.js client (Node 18+)
 * 
 * Supports:
 *  - Streamable HTTP MCP server (list_bounties, get_feed_stats, get_bounty)
 *  - REST /earn-now endpoint
 *  - Canonical JSON feed
 */

const MCP_ENDPOINT = 'https://agent-bounty-feed.dailydollar.workers.dev/mcp';
const EARN_NOW_ENDPOINT = 'https://agent-bounty-feed.dailydollar.workers.dev/earn-now';
const FEED_ENDPOINT = 'https://dailydollar-bot.github.io/agent-bounty-feed/feed.json';

async function callMcp(toolName, args = {}) {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`MCP error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`JSON-RPC Error: ${JSON.stringify(json.error)}`);
  }

  const textContent = json.result?.content?.[0]?.text;
  if (textContent) {
    try {
      return JSON.parse(textContent);
    } catch {
      return textContent;
    }
  }
  return json.result?.structuredContent || json.result;
}

async function fetchEarnNow() {
  const res = await fetch(EARN_NOW_ENDPOINT, {
    headers: { 'User-Agent': 'agent-bounty-feed-client/1.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function fetchFeed() {
  const res = await fetch(FEED_ENDPOINT, {
    headers: { 'User-Agent': 'agent-bounty-feed-client/1.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

function printBounties(items) {
  if (!items || items.length === 0) {
    console.log('No bounties found.');
    return;
  }
  console.log(`\nFound ${items.length} bounties:\n`);
  for (const b of items) {
    const src = b.source || 'unknown';
    const est = b.est_usd != null ? `$${b.est_usd}` : `${b.reward} ${b.currency || ''}`;
    const title = b.title || '(No title)';
    const url = b.url || '';
    const reqs = Array.isArray(b.requires) && b.requires.length > 0 ? b.requires.join(', ') : 'none';
    console.log(`- [${src.toUpperCase()}] ${est} | ${title}`);
    console.log(`  URL: ${url}`);
    console.log(`  Requirements: ${reqs}`);
    if (b.slots_left != null) console.log(`  Slots left: ${b.slots_left}`);
    console.log('');
  }
}

async function main() {
  const mode = process.argv[2] || '--mcp';

  console.log(`Agent Bounty Feed Client (mode: ${mode})`);

  try {
    if (mode === '--mcp' || mode === '-m') {
      console.log(`Connecting to MCP server: ${MCP_ENDPOINT}`);
      const data = await callMcp('list_bounties', { limit: 10 });
      printBounties(data.items);
    } else if (mode === '--stats' || mode === '-s') {
      console.log(`Fetching feed statistics via MCP...`);
      const stats = await callMcp('get_feed_stats');
      console.log('\nFeed Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    } else if (mode === '--earn-now' || mode === '-e') {
      console.log(`Fetching live earn-now list: ${EARN_NOW_ENDPOINT}`);
      const data = await fetchEarnNow();
      printBounties(data.items);
    } else if (mode === '--feed' || mode === '-f') {
      console.log(`Fetching raw feed: ${FEED_ENDPOINT}`);
      const data = await fetchFeed();
      printBounties(data.items);
    } else {
      console.log('Usage: node index.js [--mcp | --earn-now | --feed | --stats]');
      process.exit(1);
    }
  } catch (err) {
    console.error('Execution error:', err.message);
    process.exit(1);
  }
}

main();
