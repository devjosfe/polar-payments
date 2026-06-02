import type { Context } from "hono";
import { polar } from "../billing/polar.client.js";
import { isValidPlan, type PlanId } from "../billing/billing.plan.js";
import { hasPurchasedPlan } from "../billing/billing.service.js";

const getProductId = (planId: PlanId): string => {
  const productId =
    planId === "pro"
      ? process.env.POLAR_PRO_PRODUCT_ID
      : process.env.POLAR_MASTER_PRODUCT_ID;

  if (!productId) {
    throw new Error(`Missing product ID for plan: ${planId}`);
  }

  return productId;
};

export const billingRpc = {
  async createCheckout(c: Context) {
    const body = await c.req.json();
    const planId = body?.planId;

    if (!isValidPlan(planId)) {
      return c.json({ error: "Invalid plan selected" }, 400);
    }

    // Hardcoded for POC - no authentication
    const customerId = "poc_user_001";

    // Check if user already purchased this plan
    if (hasPurchasedPlan(customerId, planId)) {
      return c.json({ error: "You have already purchased this plan" }, 400);
    }

    const productId = getProductId(planId);
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: customerId,
      // Include plan and status in redirect URLs for frontend feedback
      successUrl: `${baseUrl}/payment?status=success&plan=${planId}`,
      // User cancelled or went back - show cancelled status
      returnUrl: `${baseUrl}/payment?status=cancelled&plan=${planId}`,
    });

    return c.json({ url: session.url });
  },
};