## pi-provider-friendli@0.0.2

### Add /login support for FriendliAI API key

Users can now run `/login` in pi's TUI to enter their FriendliAI API key
interactively when `FRIENDLI_TOKEN` is not set. The key is persisted in
pi's auth store. The `FRIENDLI_TOKEN` environment variable continues to
work as before.

## pi-provider-friendli@0.0.1

### Read API key from FRIENDLI_TOKEN and rename provider to friendli

- The provider now reads the API key from `FRIENDLI_TOKEN` instead of `FRIENDLIAI_API_KEY`.
- The provider id is now `friendli` (was `friendliai`); select models as `friendli/<model-id>`.
- README reduced to the essentials: name, install, features.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release notes are managed with [Tegami](https://tegami.fuma-nama.dev).
