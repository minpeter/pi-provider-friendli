---
packages:
  pi-provider-friendli: patch
---

## Add /login support for FriendliAI API key

Users can now run `/login` in pi's TUI to enter their FriendliAI API key
interactively when `FRIENDLI_TOKEN` is not set. The key is persisted in
pi's auth store. The `FRIENDLI_TOKEN` environment variable continues to
work as before.
