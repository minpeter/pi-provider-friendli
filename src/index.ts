import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { FALLBACK_MODELS, FRIENDLIAI_BASE_URL } from "./constants.ts";
import { refreshModels } from "./models.ts";

// Pi discovers extensions through their default export.
const friendliProvider = (pi: ExtensionAPI): void => {
  pi.registerProvider("friendliai", {
    api: "openai-completions",
    apiKey: "$FRIENDLIAI_API_KEY",
    authHeader: true,
    baseUrl: FRIENDLIAI_BASE_URL,
    models: FALLBACK_MODELS,
    name: "FriendliAI",
    refreshModels,
  });
};

export default friendliProvider;

export { FALLBACK_MODELS, FRIENDLIAI_BASE_URL } from "./constants.ts";
export { fetchModels, parseModelsResponse, refreshModels } from "./models.ts";
