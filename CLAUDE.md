# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

ccflare is a sophisticated load balancer proxy for Claude API that distributes requests across multiple OAuth accounts to prevent rate limiting. It provides intelligent session-based routing, real-time analytics, and agent detection with model preference management.

## Important: After making code changes

Always run these commands to ensure code quality:

- `bun run lint` - Fix linting issues with Biome
- `bun run typecheck` - Check for TypeScript type errors  
- `bun run format` - Format code with Biome

## Development Commands

### Running the applications

- `bun start` or `bun run server` - Start the proxy server (port 8080)
- `bun run ccflare` or `bun run tui` - Launch interactive TUI with auto-server startup
- `bun run dev:server` - Start server with hot reload
- `bun run dev:dashboard` - Start dashboard development server

### Building

- `bun run build` - Build both dashboard and TUI
- `bun run build:dashboard` - Build dashboard only
- `bun run build:tui` - Build TUI only

### CLI Commands (via TUI binary)

- `bun run tui --serve` - Start server only
- `bun run tui --add-account <name>` - Add OAuth account
- `bun run tui --list` - List all accounts
- `bun run tui --remove <name>` - Remove account
- `bun run tui --stats` - View statistics
- `bun run tui --logs` - Stream logs
- `bun run tui --analyze` - Performance analysis
- `bun run tui --reset-stats` - Reset usage statistics
- `bun run tui --clear-history` - Clear request history

## High-Level Architecture

### Monorepo Structure

```
ccflare/
├── apps/           # Deployable applications
│   ├── server/     # Main HTTP proxy server
│   └── tui/        # Terminal UI with integrated CLI
├── packages/       # Shared libraries
│   ├── agents/     # Agent discovery and workspace management
│   ├── database/   # SQLite with async writer and repositories
│   ├── http-api/   # REST API handlers
│   ├── load-balancer/ # Session-based load balancing (5hr default)
│   ├── oauth-flow/ # OAuth PKCE authentication
│   ├── providers/  # AI provider integrations (Anthropic)
│   └── proxy/      # Request forwarding with agent detection
```

### Key Architectural Patterns

1. **Session-Based Load Balancing**: Maintains 5-hour sticky sessions per account to avoid triggering anti-abuse systems. Automatic failover on account unavailability.

2. **Agent System**: Automatically detects agents from system prompts, discovers workspaces, and applies per-agent model preferences. Agents can be global (`~/.config/ccflare/agents/`) or workspace-specific (`<workspace>/.claude/agents/`).

3. **Async Database Operations**: Uses AsyncDbWriter for non-blocking database writes with queue-based batch processing every 100ms.

4. **Streaming Support**: Tees streaming responses for analytics without blocking client streams. Configurable buffer size (default 256KB).

5. **Repository Pattern**: All database operations go through typed repositories inheriting from BaseRepository.

## Testing

Currently, the project does not have a test suite configured. When implementing tests:

1. Check for existing test configuration in package.json files
2. Look for test directories in packages
3. Verify test runner setup before writing tests

## Database Schema

SQLite database with key tables:

- `accounts`: OAuth accounts with rate limit tracking and session management
- `requests`: Request logs with token usage and costs
- `request_payloads`: Request/response body storage
- `agent_preferences`: Per-agent model preferences

## API Endpoints

Key REST endpoints served at `http://localhost:8080`:

- `/health` - Health check
- `/api/accounts` - Account management
- `/api/agents` - Agent discovery and preferences
- `/api/analytics` - Advanced analytics with filtering
- `/api/requests` - Request history
- `/api/logs/stream` - Real-time log streaming
- `/dashboard` - Web UI

## Configuration

- Runtime config: `~/.config/ccflare/config.json`
- Agent definitions: `~/.config/ccflare/agents/*.md`
- Database: `~/.config/ccflare/ccflare.db`
- Logs: `~/.config/ccflare/logs/`

## Code Style

- TypeScript with strict mode
- Biome for linting and formatting
- Tab indentation
- Double quotes for strings
- Monorepo with Bun workspaces
- Path aliases: `@ccflare/*` maps to `packages/*/src`
