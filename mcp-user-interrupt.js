#!/usr/bin/env node
// ─── Internal MCP Server: user_interrupt ────────────────────────────────────
// Raw JSON-RPC 2.0 over stdio (newline-delimited). Zero external dependencies.
// Provides a "check_user_messages" tool that retrieves pending clarifications
// sent by the user while Claude is working on a task.
//
// Environment variables (set by server.js at injection time):
//   INTERRUPT_SERVER_URL  — e.g. http://127.0.0.1:3000
//   INTERRUPT_SESSION_ID  — local session ID for scoping messages
//   INTERRUPT_SECRET      — per-process auth secret

const http = require('http');
const { StringDecoder } = require('string_decoder');

const SERVER_URL = process.env.INTERRUPT_SERVER_URL || 'http://127.0.0.1:3000';
const SESSION_ID = process.env.INTERRUPT_SESSION_ID || '';
const SECRET = process.env.INTERRUPT_SECRET || '';
const MAX_STDIN_BUFFER = 10 * 1024 * 1024; // 10 MB

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

// ─── Tool definition ─────────────────────────────────────────────────────────

const CHECK_USER_MESSAGES_TOOL = {
  name: 'check_user_messages',
  description: 'Check if the user sent any clarifications or corrections while you are working. Returns pending messages or empty if none. Call this between major steps to stay aligned with user intent.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// ─── HTTP POST to Express server ─────────────────────────────────────────────

function postToServer(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(SERVER_URL);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: '/api/internal/user-interrupt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${SECRET}`,
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(responseBody)); }
        catch { resolve({ messages: [] }); }
      });
    });

    req.on('error', (err) => reject(new Error(`HTTP request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); resolve({ messages: [] }); });

    req.write(data);
    req.end();
  });
}

// ─── Handle JSON-RPC messages ────────────────────────────────────────────────

let _initialized = false;

async function handleMessage(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) — acknowledge silently
  if (id === undefined || id === null) return;

  switch (method) {
    case 'initialize':
      _initialized = true;
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: '_ccs_user_interrupt', version: '1.0.0' },
      });
      break;

    case 'tools/list':
      if (!_initialized) { sendError(id, -32002, 'Server not initialized'); return; }
      sendResponse(id, { tools: [CHECK_USER_MESSAGES_TOOL] });
      break;

    case 'tools/call': {
      if (!_initialized) { sendError(id, -32002, 'Server not initialized'); return; }
      const toolName = params?.name;
      if (toolName !== 'check_user_messages') {
        sendError(id, -32602, `Unknown tool: ${toolName}`);
        return;
      }

      try {
        const result = await postToServer({ sessionId: SESSION_ID });
        const messages = result.messages || [];

        let text;
        if (messages.length === 0) {
          text = 'No pending user messages.';
        } else {
          const lines = messages.map((m, i) =>
            messages.length === 1
              ? `User clarification: ${m.content}`
              : `${i + 1}. ${m.content}`
          );
          text = messages.length === 1
            ? lines[0]
            : `User sent ${messages.length} clarification(s) while you were working:\n\n${lines.join('\n')}\n\nAcknowledge these and adjust your approach if needed.`;
        }

        sendResponse(id, {
          content: [{ type: 'text', text }],
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: 'text', text: 'No pending user messages.' }],
        });
      }
      break;
    }

    default:
      if (id !== undefined && id !== null) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

// ─── Stdin line reader ───────────────────────────────────────────────────────

const decoder = new StringDecoder('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += decoder.write(chunk);
  if (buffer.length > MAX_STDIN_BUFFER) {
    process.stderr.write('[mcp] stdin buffer overflow, resetting\n');
    buffer = '';
    return;
  }
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      handleMessage(msg).catch((err) => {
        process.stderr.write(`user_interrupt MCP error: ${err.message}\n`);
      });
    } catch {
      // Ignore unparseable lines
    }
  }
});

process.stdin.on('end', () => {
  const remaining = buffer + decoder.end();
  if (remaining.trim()) {
    try {
      const msg = JSON.parse(remaining);
      handleMessage(msg).catch(() => {});
    } catch {}
  }
  process.exit(0);
});

// Handle SIGTERM/SIGINT gracefully
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
