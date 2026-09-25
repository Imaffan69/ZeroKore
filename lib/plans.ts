/**
 * Single source of truth for plans, prices and daily credit amounts.
 * Used by the pricing page, the credits engine, the agent route and the
 * admin panel — plan names and numbers must never be duplicated elsewhere.
 */

export type PlanId = "free" | "plus" | "pro" | "max" | "team" | "student";

export interface Plan {
  id: PlanId;
  name: string;
  dailyCredits: number; // custom/override via profiles.credits_override
  priceMonthly: number | null; // null = custom pricing / not purchasable yet
  priceYearly: number | null;
  tagline: string;
  purchasable: boolean; // Stripe-ready structure, honest until wired
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    dailyCredits: 30,
    priceMonthly: 0,
    priceYearly: 0,
    tagline: "Every model, every day, at zero cost.",
    purchasable: false,
    features: [
      "30 credits every day",
      "All models (Groq, DeepSeek, SambaNova, Gemini)",
      "Web builder, chat, agent file tools",
      "Community profile",
    ],
  },
  plus: {
    id: "plus",
    name: "Plus",
    dailyCredits: 100,
    priceMonthly: null,
    priceYearly: null,
    tagline: "3x the daily credits for daily shippers.",
    purchasable: false,
    features: [
      "100 credits every day",
      "Priority model access",
      "Higher file/tool limits",
      "Everything in Free",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    dailyCredits: 350,
    priceMonthly: null,
    priceYearly: null,
    tagline: "For heavy builders and long sessions.",
    purchasable: false,
    features: [
      "350 credits every day",
      "Longest agent context",
      "Early access to new models",
      "Everything in Plus",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    dailyCredits: 600,
    priceMonthly: null,
    priceYearly: null,
    tagline: "Effectively unlimited. Built to be abused.",
    purchasable: false,
    features: [
      "600 credits every day",
      "Highest priority routing",
      "Everything in Pro",
    ],
  },
  team: {
    id: "team",
    name: "Teams",
    dailyCredits: 600, // baseline; admins set per-workspace overrides
    priceMonthly: null,
    priceYearly: null,
    tagline: "Custom daily credits, set per workspace.",
    purchasable: false,
    features: [
      "Custom credits per member",
      "Centralized billing (soon)",
      "Shared skills library (soon)",
    ],
  },
  student: {
    id: "student",
    name: "Student",
    dailyCredits: 0, // stacked on top of the base plan (+50/day)
    priceMonthly: 0,
    priceYearly: 0,
    tagline: "Verified students get +50 bonus credits every day.",
    purchasable: false,
    features: ["+50 bonus credits per day", "Verify with a school email", "Renews annually"],
  },
};

export const STUDENT_BONUS = 50;
export const REFERRAL_BONUS = 25;
export const FEEDBACK_BONUS = 2;

/** Credits cost: 1 base + 1 per 4k tokens (prompt + completion combined). */
export const BASE_CREDIT_COST = 1;
export const TOKENS_PER_CREDIT = 4000;

export function creditsForTokens(promptTokens: number, completionTokens: number): number {
  const total = Math.max(0, promptTokens) + Math.max(0, completionTokens);
  return BASE_CREDIT_COST + Math.ceil(total / TOKENS_PER_CREDIT);
}

export function planRank(plan: PlanId): number {
  return { free: 0, student: 0, plus: 1, pro: 2, max: 3, team: 3 }[plan];
}

export function dailyCreditsFor(plan: PlanId, override: number | null | undefined): number {
  if (typeof override === "number" && override >= 0) return override;
  return PLANS[plan]?.dailyCredits ?? PLANS.free.dailyCredits;
}
