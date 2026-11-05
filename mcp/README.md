# miniature-studio-mcp

MCP server that lets an AI agent (Claude Code, Claude Desktop, Cursor…) drive Miniature Studio, open on your computer: brief, generate, edit, rank, export.

```
agent ──MCP (stdio)──▶ miniature-studio-mcp ──WebSocket 127.0.0.1──▶ studio tab ──▶ Nano Banana (your key)
```

The server only relays. API keys, projects and images stay in the browser; the studio runs every action exactly as a click would, and you watch it happen.

## Setup

From the project's folder:

```bash
npm run build:mcp
claude mcp add miniature-studio -- node "$PWD/mcp/dist/index.js"
```

Then ask the agent to "open Miniature Studio": it opens a pairing link, you click **Allow** once in the studio. The studio then reconnects by itself whenever the agent runs.

### Companion skill

The tools say *what* the agent can do; the skill teaches it *how* to make a good thumbnail (workflow, brief writing, critique, credit discipline):

Copy [`skills/miniature-studio/`](../skills/miniature-studio/SKILL.md) into your agent's skills folder (`~/.claude/skills/` for Claude Code).

## Configuration (env)

| Variable | Default | |
|---|---|---|
| `MINIATURE_STUDIO_URL` | `http://127.0.0.1:17830/app/` | Studio opened for pairing |
| `MINIATURE_STUDIO_PORT` | `17821` | Local WebSocket port |
| `MINIATURE_STUDIO_ORIGINS` | | Extra allowed page origins, comma-separated |
| `MINIATURE_STUDIO_TOKEN` | generated, kept in `~/.config/miniature-studio/mcp.json` | Pairing token |

## Security

- Listens on `127.0.0.1` only, accepts only the studio origins, then requires the pairing token.
- The studio asks for confirmation before accepting a pairing link, shows every agent action, and can disconnect at any time.
- Agents can't read or change API keys, and can't delete anything.

## Local development

```bash
npm run build:mcp   # → mcp/dist/index.js
npm run dev         # studio on http://localhost:4321
claude mcp add miniature-studio-dev -e MINIATURE_STUDIO_URL=http://localhost:4321/app -- node "$PWD/mcp/dist/index.js"
```

Tool definitions are shared with the studio (`src/app/agent/protocol.ts`); handlers live in `src/app/agent/tools.ts`.
