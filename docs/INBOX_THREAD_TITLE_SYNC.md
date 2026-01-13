# Inbox backend stub: title sync from messages

In backend_stub mode, thread titles can be missing or generic.
To make the UI feel realistic (and to avoid many “Thread” rows), the API derives a fallback title.

## Rules
A title is considered generic if:
- empty
- equals "Thread" or "Conversation"
- starts with "Thread "

Fallback title order:
1) first message text (trimmed, whitespace normalized)
2) last message text
3) thread id

The fallback is truncated to ~32 chars.

## Where applied
- `GET /api/inbox/threads` returns derived title per item
- `GET /api/inbox/thread/[id]` returns derived title in `thread.title`
