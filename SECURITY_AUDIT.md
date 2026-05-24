# Security Audit Report — cloudcli-plugin-file-manager v1.0.0

**Date:** 2026-05-24
**Auditor:** Independent review prior to public release
**Scope:** All source files (server.js, index.js, manifest.json, package.json, icon.svg)
**Status:** PASS — all identified issues addressed

---

## Summary

The file-manager plugin was audited for security vulnerabilities, information disclosure, and code quality prior to public release on GitHub. All findings have been addressed in the published version.

## Architecture Security

| Property | Status |
|----------|--------|
| Server binds to `127.0.0.1` only | PASS |
| Path traversal protection (resolve + allowlist) | PASS |
| Configurable allowed root directories via env var | PASS |
| XSS prevention via `escHtml` on all rendered data | PASS |
| No hardcoded credentials or secrets | PASS |
| No personal information in source | PASS |

## Findings (All Resolved)

### 1. URL Query Parameter Parsing — Fixed
**Severity:** LOW
**Issue:** `decodeURIComponent` was unguarded and could throw on malformed `%`-sequences. Additionally, parameter values containing `=` (e.g., JWT tokens) were truncated.
**Resolution:** Wrapped in try/catch; changed split to preserve all `=` characters in values.

### 2. Error Message Information Disclosure — Fixed
**Severity:** LOW
**Issue:** Raw OS error messages (including internal paths) were returned in 500 responses.
**Resolution:** Replaced with generic error message: `"Failed to list directory"`.

### 3. Content-Disposition Filename — Fixed
**Severity:** LOW
**Issue:** Filenames containing double-quote characters could break the `Content-Disposition` header.
**Resolution:** Double quotes in filenames are now escaped.

### 4. Cookie Token Parsing — Fixed
**Severity:** MEDIUM
**Issue:** Auth token extraction from cookies was fragile — JWT tokens containing `=` were truncated.
**Resolution:** Changed to `split('=').slice(1).join('=')` to preserve full token value.

## Accepted Design Decisions

### CORS Wildcard
The server sets `Access-Control-Allow-Origin: *`. This is mitigated by binding to `127.0.0.1` only. The server is not directly accessible from the browser — all requests go through CloudCLI's plugin RPC proxy, which handles authentication. If deploying in a non-CloudCLI context, restrict the CORS origin.

### `.env` File Preview
The plugin will preview `.env` files if they exist within the allowed root directories. This is by design for a file manager. Users should be aware that anyone with CloudCLI access can view files within the configured roots. Restrict `FILE_MANAGER_ROOTS` to appropriate directories.

## Recommendations for Deployers

1. Set `FILE_MANAGER_ROOTS` to only the directories users need access to
2. Do not include sensitive directories (e.g., `/etc`, `/root/.ssh`) in allowed roots
3. Ensure CloudCLI authentication is enabled when exposed to networks

## Clean Items

- No hardcoded credentials, tokens, API keys, or passwords
- No personal identifiers, IP addresses, or hostnames
- No environment-specific paths (all configurable via env vars)
- SVG icon contains only geometry, no embedded data
- MIT license with no restrictive clauses
