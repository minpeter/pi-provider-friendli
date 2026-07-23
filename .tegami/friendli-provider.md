---
packages:
  pi-provider-friendli: patch
---

## Read API key from FRIENDLI_TOKEN and rename provider to friendli

- The provider now reads the API key from `FRIENDLI_TOKEN` instead of `FRIENDLIAI_API_KEY`.
- The provider id is now `friendli` (was `friendliai`); select models as `friendli/<model-id>`.
- README reduced to the essentials: name, install, features.
