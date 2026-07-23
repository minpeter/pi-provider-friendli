import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { FALLBACK_MODELS, FRIENDLIAI_BASE_URL } from "./constants.ts";
import { refreshModels } from "./models.ts";

// Pi discovers extensions through their default export.
const friendliProvider = (pi: ExtensionAPI): void => {
  pi.registerProvider("friendli", {
    api: "openai-completions",
    apiKey: "$FRIENDLI_TOKEN",
    authHeader: true,
    baseUrl: FRIENDLIAI_BASE_URL,
    models: FALLBACK_MODELS,
    name: "FriendliAI",
    oauth: {
      getApiKey(credentials) {
        return credentials.access;
      },
      async login(callbacks) {
        const key = await callbacks.onPrompt({
          message: "Enter your FriendliAI API key",
          placeholder: "flp_...",
        });
        return { access: key, expires: Number.MAX_SAFE_INTEGER, refresh: "" };
      },
      name: "FriendliAI",
      refreshToken: (credentials) => Promise.resolve(credentials),
    },
    refreshModels,
  });
};

export default friendliProvider;

export { FALLBACK_MODELS, FRIENDLIAI_BASE_URL } from "./constants.ts";
export { fetchModels, parseModelsResponse, refreshModels } from "./models.ts";
