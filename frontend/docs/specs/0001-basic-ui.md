# 0001 · Basic warehouse UI

**Status**: Accepted
**Date**: 14/10/2026
**Source**: `../../../docs/frontend-handoff/HANDOFF.md`, sections 0 through 12, and its `design/*.dc.html` files. These are already supplied decisions, not a new stack proposal.

## Decision

Implement only milestone 15/10. Use Vite, React 18, TypeScript, React Router v6, Zustand, Recharts, CSS Modules and the supplied CSS tokens. Keep mock reads behind a typed API interface. Preserve the Vietnamese copy, route map and role matrix. Use the handoff's defaults for unresolved team decisions.

## Requirements

- AC-1: The project runs without backend services and exposes dev, build, lint and test scripts with exact dependency versions.
- AC-2: Nine screen variants render at 1440px and 375px without page overflow. Wide tables scroll internally.
- AC-3: Mock login uses admin, operator01 and viewer01. In-memory and sessionStorage sessions survive refresh and clear on logout.
- AC-4: Non-admins cannot enter users or device registration routes or view the audit tab. Viewer controls are disabled. Admin self controls are disabled.
- AC-5: The shared shell, fonts, colors, spacing, cards, tables, stat tiles and three independent charts follow the supplied designs. Every control has an accessible name and visible focus.
- AC-6: Loading, retryable errors and empty results have visible states. Local navigation, filters and form edits work. Later milestone actions explain their planned availability without claiming a device command or saved mutation succeeded.

## Value sourcing

| Value | Source |
|-------|--------|
| User, role and session | Typed mock login and me methods; mock token stored in sessionStorage |
| Devices, telemetry, alerts, commands, audit, users and configuration | Design sample data mapped to the handoff's snake_case types |
| Overview charts | Deterministic mock telemetry history for selected 1, 6 or 24 hour window |
| Device variant | One getDeviceKind helper using _ENV and _SEC suffixes; unknown type has an explicit empty state |
| Smoke unit, domain and threshold | One monitoring config object: ppm, 0 to 400, 300 |
| Demo hardware states | Explicit presentation fixture for fan, buzzer and LED; no inference from real hardware |
| Date and number display | vi-VN, Asia/Ho_Chi_Minh; fixed fixture snapshot dated 13/10/2026 |

## Composition

Login uses the supplied dark introduction beside the form. Every other route uses the wrapping sidebar and content shell. Overview orders header, incident banner, five readings, three charts, then controls/devices/alerts. Details place metadata beside status, config and command cards. Devices uses lifecycle counts and a filterable table. Registration uses the three step strip and form beside lifecycle help. Alerts uses status tabs, filters and rows. History uses URL tabs and a table. Users places the account table beside the creation form. No external imagery is needed; icons come from the supplied SVG paths.

## Build plan

- [x] Scaffold exact dependencies, tokens and semantic common components (AC-1, AC-5).
- [x] Implement typed mock reads, auth store, loading and error states (AC-3, AC-6).
- [x] Implement all nine screens and route guards (AC-2, AC-4, AC-5).
- [x] Run build, lint, role/format tests and browser checks at both widths (AC-1 through AC-6).

## Consequences

This milestone is a UI prototype. No live MQTT or WebSocket connection, real REST adapter, hardware commands, durable writes, token generation, CSV or backend authorization is claimed. Deferred action buttons show an explicit milestone notice. Mock data does not persist across reloads. Session persistence is for demonstration only. Authenticated fixtures are accessed through the API interface rather than imported by pages.
