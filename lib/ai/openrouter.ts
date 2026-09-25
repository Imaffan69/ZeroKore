/**
 * OpenRouter model catalog.
 *
 * OpenRouter fronts hundreds of models behind one OpenAI-compatible endpoint,
 * so each model is registered as its own selectable provider (`OpenRouter:<id>`)
 * rather than hiding behind a single "OpenRouter" option. The user picks the
 * exact model; nothing is silently substituted.
 *
 * Every slug below was read from the live `GET /api/v1/models` endpoint, not
 * guessed — a wrong slug does not fail loudly, it returns a 404 that looks
 * like a generic provider outage. `contextLength` and the free flag come from
 * the same response.
 *
 * Pricing is recorded for display only. ZeroKore meters its own credits; the
 * per-token costs here are what OpenRouter charges *us*, and a model marked
 * free is genuinely $0/M there.
 */

export interface OpenRouterModel {
  /** The exact OpenRouter model id sent in the request. */
  id: string;
  /** Human label for the picker. */
  label: string;
  /** Context window in tokens, as published by OpenRouter. */
  contextLength: number;
  /** True when OpenRouter lists $0/M input and output. */
  free: boolean;
  /** Grouped in the picker so the list stays scannable. */
  group: "Coding" | "Reasoning" | "Fast" | "General";
  /**
   * False when the model cannot be called through ZeroKore's plain
   * chat-completions path. Verified against the live API, not assumed:
   *
   * - The two `thinkingmachines/inkling*` models answer 403 with "only available
   *   on agentic harnesses", so they are not offered rather than failing on click.
   * - `inclusionai/ling-3.0-flash:free` is listed in the catalogue but answers 404
   *   ("unavailable for free"); the paid id is what actually resolves.
   */
  available: boolean;
  /** Why an unavailable model is hidden, shown in the picker as a disabled row. */
  unavailableReason?: string;
}

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  // Coding agents — all verified returning 200 through this exact path.
  {
    id: "poolside/laguna-s-2.1:free",
    label: "Poolside · Laguna S 2.1",
    contextLength: 262144,
    free: true,
    group: "Coding",
    available: true,
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    label: "Poolside · Laguna XS 2.1",
    contextLength: 262144,
    free: true,
    group: "Coding",
    available: true,
  },
  {
    id: "cohere/north-mini-code:free",
    label: "Cohere · North Mini Code",
    contextLength: 256000,
    free: true,
    group: "Coding",
    available: true,
  },
  {
    id: "nex-agi/nex-n2.5-pro:free",
    label: "Nex AGI · Nex-N2.5-Pro",
    contextLength: 262144,
    free: true,
    group: "Coding",
    available: true,
  },
  {
    id: "nex-agi/nex-n2.5-mini:free",
    label: "Nex AGI · Nex-N2.5-Mini",
    contextLength: 262144,
    free: true,
    group: "Coding",
    available: true,
  },

  // Reasoning / orchestration
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "NVIDIA · Nemotron 3 Ultra",
    contextLength: 262144,
    free: false,
    group: "Reasoning",
    available: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "NVIDIA · Nemotron 3.5 Lightning",
    contextLength: 1000000,
    free: true,
    group: "Reasoning",
    available: true,
  },
  {
    id: "thinkingmachines/inkling:free",
    label: "Thinking Machines · Inkling",
    contextLength: 1048576,
    free: true,
    group: "Reasoning",
    available: false,
    unavailableReason:
      "Restricted by the provider to agentic harnesses — not callable from ZeroKore.",
  },
  {
    id: "thinkingmachines/inkling-small:free",
    label: "Thinking Machines · Inkling Small",
    contextLength: 1048576,
    free: true,
    group: "Reasoning",
    available: false,
    unavailableReason:
      "Restricted by the provider to agentic harnesses — not callable from ZeroKore.",
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    label: "Dots Studio · Dots3-Note Preview",
    contextLength: 512000,
    free: true,
    group: "Reasoning",
    available: true,
  },

  // Fast / cheap
  {
    id: "nvidia/nemotron-3.5-lightning",
    label: "NVIDIA · Nemotron 3.5 Lightning (paid)",
    contextLength: 262144,
    free: false,
    group: "Fast",
    available: true,
  },
  {
    // The `:free` variant of this model is listed in OpenRouter's catalogue but
    // answers 404 ("unavailable for free"). The paid id is the one that resolves.
    id: "inclusionai/ling-3.0-flash",
    label: "inclusionAI · Ling 3.0 Flash",
    contextLength: 262144,
    free: false,
    group: "Fast",
    available: true,
  },

  // General / domain
  {
    id: "inclusionai/ling-3.0-flash-fin:free",
    label: "inclusionAI · Ling 3.0 Flash Fin (finance)",
    contextLength: 262144,
    free: true,
    group: "General",
    available: true,
  },
  {
    id: "inclusionai/ling-3.0-flash-sante:free",
    label: "inclusionAI · Ling 3.0 Flash Sante (health)",
    contextLength: 262144,
    free: true,
    group: "General",
    available: true,
  },
  {
    id: "qwen/qwen3.8-27b:free",
    label: "Qwen · Qwen3.8 27B",
    contextLength: 262144,
    free: true,
    group: "General",
    available: true,
  },
  {
    id: "stealth/space-bunny-alpha",
    label: "Stealth · Space Bunny Alpha",
    contextLength: 1000000,
    free: true,
    group: "General",
    available: true,
  },
];

/** The first OpenRouter model the cascade should try.
 *
 * Deliberately a cheap, tool-capable, free model: the cascade runs on every
 * request, so its default has to be fast and cost-free rather than the strongest
 * model available. A user can pin any model above for a harder task.
 */
export const OPENROUTER_DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning:free";

/** Only models verified to work through this API path. */
export function availableOpenRouterModels(): OpenRouterModel[] {
  return OPENROUTER_MODELS.filter((m) => m.available);
}

/** The provider name used for a given OpenRouter model id. */
export function openRouterProviderName(modelId: string): string {
  return `OpenRouter:${modelId}`;
}

/** Parse `OpenRouter:<modelId>` back into the model id, or null. */
export function parseOpenRouterProvider(
  name: string
): { modelId: string; label: string } | null {
  if (!name.toLowerCase().startsWith("openrouter:")) return null;
  const modelId = name.slice("openrouter:".length).trim();
  if (!modelId) return null;
  const known = OPENROUTER_MODELS.find((m) => m.id === modelId);
  return { modelId, label: known?.label ?? modelId };
}

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
