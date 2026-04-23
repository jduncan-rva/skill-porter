---
name: api-connector
description: "Connects to REST APIs with authentication, constructs HTTP requests with headers and query parameters, and parses JSON responses. Use when the user needs to make GET/POST/PUT/DELETE requests, fetch data from an API, manage API keys or OAuth tokens, handle pagination, or integrate with external API endpoints."
allowed-tools: "Read, Glob, Grep, Task, WebFetch, WebSearch, TodoWrite, AskUserQuestion, SlashCommand, Skill, NotebookEdit, BashOutput, KillShell"
---

# API Connector

Connects to REST APIs, manages authentication, and processes JSON responses for external service integration.

## Workflow

1. **Configure authentication** — set `API_KEY` and `API_BASE_URL` as environment variables
2. **Construct the request** — choose method (GET/POST/PUT/DELETE), set headers, build query parameters or JSON body
3. **Execute the request** — send via `curl` or `fetch` with appropriate timeout
4. **Validate the response** — check HTTP status code, parse JSON body
5. **Handle errors and retries** — retry on 429/5xx with exponential backoff, surface clear error messages

## Configuration

| Variable | Required | Default |
|----------|----------|---------|
| `API_KEY` | Yes | — |
| `API_BASE_URL` | No | `https://api.example.com` |
| `API_TIMEOUT` | No | `30000` (ms) |

## Examples

### GET request with authentication header

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     "$API_BASE_URL/users?page=1&per_page=25"
```

### POST request with JSON body

```bash
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name": "New Item", "status": "active"}' \
     "$API_BASE_URL/items"
```

### Parse a JSON response

```bash
response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/status" \
           -H "Authorization: Bearer $API_KEY")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  echo "$body" | jq '.data'
else
  echo "Error: HTTP $http_code — $body" >&2
fi
```

### Handle pagination

The agent iterates pages until an empty result set is returned, appending each page's data to a combined output.

## Safety

This skill operates in read-only mode by default. It makes HTTP requests to configured API endpoints but does not execute arbitrary commands or write files unless explicitly instructed.

---

*This skill was converted from a Gemini CLI extension using [skill-porter](https://github.com/jduncan-rva/skill-porter)*
