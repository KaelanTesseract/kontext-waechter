# Context Watcher (Kontext-Wächter)

*[Deutsche Version](README.de.md)*

A mod for Claude Code that shows how full your session's context is, tells you when it is worth switching to a fresh session, and writes a handover note for you with one click. Fewer wasted tokens, better answers in long sessions.

```
/plugin install kontext-waechter --marketplace KaelanTesseract/kontext-waechter
```

![The bar above the prompt box](docs/screenshot.png)

## Why

With every reply, Claude sends the whole conversation again. The longer a session runs, the more is carried along on each message: it gets more expensive, and answers tend to get less precise. Starting fresh at the right moment, with a clean summary, saves money and keeps quality up. The Context Watcher does the watching for you.

## What it does

**Context fill at a glance.** A bar above the prompt box shows the percentage, the tokens in use and the cost so far. It updates after every reply and also appears in the status line.

**A recommendation for when to stop.**

| Fill level | Advice |
|---|---|
| below 50 % | Keep working |
| from 50 % | Start fresh when you change topic |
| from 70 % | A summary and a new session pay off now |
| from 85 % | Summarize and start fresh now |

A short notice also appears when you cross 70 % and 85 %.

**Handover in one click.** The "Übergabe" button (handover) has Claude write a note for the next session: goal, current state, decisions made, important files, next steps, known pitfalls and how you like to work. It is saved in your project folder as `.claude/uebergabe/LETZTE.md`, plus a dated copy.

**New session opened for you (desktop app).** The second button, "+ neue Session", also asks Claude to open a fresh session in the same folder that reads the handover and carries on. The mod cannot open sessions itself, so it asks Claude to do it; this works in the desktop app only.

**Seamless continuation.** In the new session, type `/weiter`. The handover is loaded, Claude summarizes where you stand and carries on with the first next step. If an unread handover is waiting at startup, the mod tells you.

**Subagents counted separately.** Subagents have their own context and do not fill the main session's. They are not part of the bar, but their runs and tokens are shown next to it.

## Commands

| Command | Effect |
|---|---|
| `/uebergabe` | Creates the handover, same as the button |
| `/weiter` | Loads the last handover into the new session |
| `/waechter` | Shows or hides the bar |

## Install

In a terminal session:

```
/plugin install kontext-waechter --marketplace KaelanTesseract/kontext-waechter
```

From a shell:

```
claude plugin install kontext-waechter --marketplace KaelanTesseract/kontext-waechter
```

In the desktop app, `/plugin` does not run. Click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `KaelanTesseract/kontext-waechter`, then **Add plugin**.

To update: `claude plugin update kontext-waechter`.

## New session or `/compact`?

`/compact` replaces the conversation inside the running session with a summary that Claude chooses itself. It is quick, but details can get lost unnoticed. A new session with a handover starts empty and only knows what you hand over. You can read and edit the handover first.

Rule of thumb: same topic and 50 to 70 % full, `/compact` is enough. From 70 %, or for a new topic, the handover is the better choice.

## Customize

The thresholds (50, 70, 85 percent) are at the top of `hooks/register.tsx`. The text that asks for the handover is there too (it is written in German; change it to your language if you like).

## Notes

- The "create handover" button only works after at least one reply has run in the session.
- Handover files live in your project folder. To keep them out of Git, add `.claude/uebergabe/` to your `.gitignore`.
- The dollar amount comes from Claude Code itself. Whether it includes subagent costs depends on how Claude Code counts.
- The fill level is the value Claude Code reports after the last reply. It does not change between replies.
- The interface text is in German.

## License

MIT, see [LICENSE](LICENSE).
