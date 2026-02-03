# Security Notes

## Vulnerability Status

Last audit: February 2026

### High/Critical Vulnerabilities

| Package | Severity | Status | Notes |
|---------|----------|--------|-------|
| `tar` | High | **FIXED** | Updated to 7.5.7 |
| `fast-xml-parser` | High | Mitigated | In @aws-sdk/xml-builder (transitive). AWS SDK uses it safely for XML parsing. No user input reaches this parser. |
| `form-data` | Critical | Cannot Fix | In deprecated `request` package via matrix-bot-sdk extension. The extension is optional and disabled by default. |
| `qs` | High | Cannot Fix | In deprecated `request` package via matrix-bot-sdk extension. Same as above. |

### Mitigations Applied

1. **fast-xml-parser**: The vulnerability is a DoS via numeric entities. Our usage through AWS SDK doesn't expose this to untrusted input - all XML is generated internally.

2. **form-data/qs/request**: These are in the optional Matrix extension (`extensions__matrix`). This extension is:
   - Disabled by default
   - Not loaded unless explicitly enabled
   - Only affects Matrix bridge functionality (not core app)
   
   **Recommendation**: Do not enable the Matrix extension in production until upstream fixes are available.

### Packages Requiring Manual Update

The `request` package is deprecated and has no fix. The matrix-bot-sdk dependency uses it. Options:
1. Wait for matrix-bot-sdk to migrate to a modern HTTP client
2. Fork and patch matrix-bot-sdk (significant effort)
3. Keep the extension disabled (current approach)

## Security Headers

The following headers are applied in production:

- `Content-Security-Policy`: Restricts resource loading
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin`: Limits referrer leakage
- `Permissions-Policy`: Disables unnecessary APIs
- `Strict-Transport-Security`: Enforces HTTPS (when behind HTTPS proxy)
- `X-Powered-By`: **Removed** (Express fingerprinting disabled)

## Authentication

- Gateway authentication uses token-based auth
- Tokens must be set via `GATEWAY_TOKEN` environment variable
- Tokens are never logged or exposed in API responses
- WebSocket connections require valid token in connect handshake

## API Key Handling

- All LLM provider API keys are read from environment variables only
- Keys are never logged, even at startup
- Only boolean "configured" status is exposed via API
- Keys are not stored in any configuration files
