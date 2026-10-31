# Agent API

the-daily.studio offers its main actions as tools for an AI agent running in the person's browser. Everything runs inside the page: there is no server, nothing is sent anywhere, and the tools cannot reach the microphone, the camera, recording, deleting songs or Settings. The code is `src/parts/72-agent.js`.

## Two ways in

| Way | For | How |
| --- | --- | --- |
| **WebMCP** | browser assistants and extensions that speak MCP | `navigator.modelContext.registerTool()` for each tool (or `provideContext()` in earlier drafts) |
| **`window.dailyStudio`** | agents that drive pages with scripts, and tests | `dailyStudio.tools()`, `dailyStudio.call(name, input)` (returns a Promise), `dailyStudio.describe()` |

Both run the same functions as the buttons. Desktop MCP clients (Claude Desktop, Claude Code) can reach the WebMCP tools through a browser extension that relays a page's WebMCP tools to MCP clients; nothing in the app changes for that.

## The tools (API 2)

| Tool | Reads or changes | Required inputs |
| --- | --- | --- |
| `get_song` | reads | none |
| `get_studio_state` | reads | none |
| `get_key_chords` | reads | none |
| `get_chord_shape` | reads | `chord` |
| `list_songs` | reads | none |
| `export_song` | reads | `format` |
| `load_chord_sheet` | changes | `text` |
| `set_song_details` | changes | none |
| `transpose_song` | changes | `semitones` |
| `edit_section` | changes | `section` |
| `add_section` | changes | `name`, `chords` |
| `remove_section` | changes (destructive, undoable) | `section` |
| `set_band` | changes | none |
| `transport` | changes (never records) | none |
| `set_visuals` | changes (never the camera) | none |
| `perform` | changes (never the microphone) | none |
| `open_workspace` | changes | `workspace` |
| `open_song` | changes | `song` |
| `undo` | changes | none |

`dailyStudio.tools()` gives each tool's description, JSON input schema and annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`; WebMCP also gets `openWorldHint: false` and a title).

## Answers

- Every answer has `content: [{ type: 'text', text }]`. When the answer is an object it also has `structuredContent` with the same data.
- Errors have `isError: true` and `structuredContent: { error: { code, message } }`. The codes are:

| Code | Meaning |
| --- | --- |
| `unknown_tool` | no tool by that name |
| `disabled` | the person turned agent access off (Settings ▸ Workflow) |
| `loading` | the studio is still starting |
| `invalid_input` | the input does not match the schema (the message names the problem) |
| `busy` | too many calls in a second; wait and try again |
| `timeout` | the call took longer than 20 s (a change may still finish; check with `get_song`) |
| `rejected` | the studio refused, with the reason (no such section, an unknown key, the studio is recording…) |

## Limits

- Changes run one at a time, in the order they arrive. Reads do not wait.
- Up to 20 changes and 40 reads a second; more are answered `busy`.
- 20 s per call. Answers longer than 250,000 characters are cut, with a note.
- Inputs are copied before they are used, so nothing the agent holds can change mid-call. Text inputs are capped (200,000 characters for a chord sheet, 20,000 for anything else).
- A burst of changes shows one 🤖 note on screen ("… and 2 more"). Every change is one undo step.

## Versioning and the contract

- `dailyStudio.version` (and `describe().api`, and `get_studio_state.api`) is the **API version**, now `2`. It goes up only for a breaking change: a tool removed or renamed, or a required input changed. New tools and new optional inputs keep it.
- A renamed tool keeps its old name in `AG_ALIAS`, so an agent written for an earlier version still works.
- `test/agent-contract.json` lists the published tools and their required inputs. `test/e2e-agent.cjs` fails if one disappears or changes, so a breaking change cannot slip in: raise `AG_API` (or add an alias) and update the file on purpose.
- `describe()` also gives the app version and build code, whether WebMCP is in use and how (`registerTool` or `provideContext`), whether agent access is on, the aliases and the limits.

## WebMCP details

- Each tool is registered on its own, so one refusal does not lose the rest. If the browser already holds a name, it is taken back (`unregisterTool`) and offered again.
- `navigator.modelContext` may arrive after the page loads (an extension adds it, say). The studio looks again after 0.6, 2, 5 and 15 seconds, and offers the tools again if a different `navigator.modelContext` appears.
- Turning agent access off in Settings withdraws every tool (each tool's `unregister()`, or `unregisterTool`, or `clearContext`), and calls are answered `disabled`.
