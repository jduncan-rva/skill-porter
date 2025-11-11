# API Connector - Gemini CLI Extension

Connect to REST APIs, manage authentication, and process responses.

## Features

- Make GET, POST, PUT, DELETE requests
- Automatic authentication header management
- JSON response parsing
- Rate limiting and retry logic
- Response caching

## Configuration

**Required:**
- `API_KEY`: Your API authentication key

**Optional:**
- `API_BASE_URL`: Base URL (default: https://api.example.com)
- `API_TIMEOUT`: Timeout in ms (default: 30000)

## Usage

```
"Get data from /users endpoint"
"POST this JSON to /api/create"
"Check the API status"
```

## Safety

This extension operates in read-only mode:
- Cannot execute bash commands
- Cannot edit local files
- Cannot write files to disk

Only makes HTTP requests to configured API endpoints.
