export type PlanId = "pro" | "master";

export function isValidPlan(plan: string): plan is PlanId {
  return plan === "pro" || plan === "master";
}
// creating plans here and a function that validates the input of plan (didnt used zod)
