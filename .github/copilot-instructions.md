# Copilot Instructions — openfront-client

> This file provides GitHub Copilot with project-wide context.
> Keeping this concise and accurate reduces token usage by 20-30%.
> Last updated: 2026-10-26

## Stack & versions
- VueJS 3 (Composition API), TypeScript, Vite, Pinia

## Project conventions
- Follow existing naming in the file you're editing
- Write tests alongside implementation (co-located __tests__ or test_ files)
- Prefer explicit types over inference for public APIs
- Financial values: always use Decimal, never float
- No console.log / print in production paths — use the project logger
- Vue: composables in src/composables/, max 200 lines per SFC

## File structure
```
frontend/
  src/
    components/  # presentational, dumb
    composables/ # reusable logic hooks
    stores/      # Pinia stores
    views/       # route-level pages
```

## VueJS patterns
- Composition API only — no Options API in new code
- Composables: prefix with `use`, return reactive refs, handle cleanup in `onUnmounted`
- Pinia stores: one store per domain; actions are async, mutations via `$patch`
- Props: always typed with `defineProps<{}>()`; emit typed with `defineEmits<{}>()`
- No direct DOM manipulation; use template refs sparingly
- Formatting: Prettier defaults; component names PascalCase

```vue
<!-- Preferred composable usage -->
<script setup lang="ts">
const { data, isLoading } = useReportData(props.reportId)
</script>
```

## Token-efficient workflow
- **Plan first**: Use agent mode to draft a plan before implementation; review it before generating code
- **Scoped context**: Use #file, #selection, #symbol references — avoid pasting full file contents in chat
- **Chat hygiene**: Start a new chat (Ctrl+N / Cmd+N) when switching topics; use /compact to summarize long sessions
- **Forking**: Use /fork or hover → Fork Conversation to explore alternatives without re-establishing full context
- **Model selection**: Leave model on auto — VS Code routes each request to the most efficient model per task type
- **Thinking effort**: Use default adaptive thinking; only set to "high" for architectural decisions with genuine complexity
- **Token visibility**: Use Copilot Agent Debug Logs (Command Palette: "Copilot: Open Chat Debug View") to inspect usage

## Chat context management
- When a conversation exceeds **5 exchanges**, treat only the **last 5 user + assistant turns** as active context unless an earlier message is explicitly referenced via #file or #symbol.
- Discard earlier turns to avoid stale or contradictory instructions creeping back in.
- To override this limit for a specific request, append `#ctx:N` at the end of your prompt (e.g. `#ctx:3` to use only the last 3 turns, or `#ctx:all` to include the full history).
- To reset context entirely, start a new chat with `Ctrl+N` / `Cmd+N` rather than continuing a long thread.

### Shorthand reference
| Shorthand | Meaning |
|---|---|
| `#ctx:3` | Use only the last 3 messages as context |
| `#ctx:5` | Use only the last 5 messages as context (default cap) |
| `#ctx:all` | Include full conversation history |
| `#ctx:reset` | Treat this as the start of a fresh conversation |

## Do not
- Do not use `any` in TypeScript or Python without a `# type: ignore` comment explaining why
- Do not write migration files manually — use the ORM CLI
- Do not commit secrets, API keys, or connection strings
- Do not add dependencies without updating the relevant lock file
- Do not use float for financial calculations

<!-- caveman-begin -->
Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:
- Answer first: Answer, then reason, then next step.
- Kill ceremony: No greeting, hedging, pleasantries, recap, or closer.
- Short word: "fix" not "implement a solution for".
- Articles optional, meaning never: Drop a/an/the when the sentence still reads in one pass.
- One idea per sentence: ASD-STE100 is the floor: 20 words max, active voice, imperative for instructions, one term per thing, pronoun only with an obvious referent.
- Payload verbatim: Code blocks unchanged.
- Tool runs: bounded status: No text between routine calls.
- User's language: Compress the style, not the language.
- Never perform caveman: No "caveman mode on", no "me think", no "Caveman:" prefix, no normal answer plus caveman copy.

Switch: /caveman (default), /ultracave (fragments, each fact once), /megacave (Classical Chinese 文言文)
Stop: "stop caveman" or "normal mode"

Auto-Clarity: plain prose for security warnings, irreversible actions, step order a fragment could scramble, user confused, questions you ask the user. Resume after.

Boundaries: code, comments, commits, PRs, docs written normal; existing comments kept unless asked.
Floor: code, commands, paths, numbers and error strings verbatim; never drop not/never/no/only.
<!-- caveman-end -->
