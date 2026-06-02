import type { PlanId } from "./billing.plan.js";

// this is the business logic layer of billing it is seperated from webhooks for reusability testability and clean codebase
// in our app this will update db enable/disable feature flags send emails or notifications maybe or sync with other services

// ============================================
// IN-MEMORY PURCHASE STORE (POC only)
// In production, this would be a database
// ============================================

interface Purchase {
  oderId: string;
  customerId: string;
  productId: string;
  planId: PlanId;
  purchasedAt: Date;
  status: "active" | "canceled" | "revoked";
}

// Map: customerId -> array of purchases
const purchaseStore = new Map<string, Purchase[]>();

// Map: productId -> planId (for reverse lookup)
const productToPlanMap = new Map<string, PlanId>();

// Initialize product to plan mapping from environment
export function initProductPlanMapping(): void {
  const proProductId = process.env.POLAR_PRO_PRODUCT_ID;
  const masterProductId = process.env.POLAR_MASTER_PRODUCT_ID;

  if (proProductId) {
    productToPlanMap.set(proProductId, "pro");
  }
  if (masterProductId) {
    productToPlanMap.set(masterProductId, "master");
  }
}

/**
 * Records a purchase for a customer.
 * Called when subscription becomes active or order is paid.
 */
export function recordPurchase(
  customerId: string,
  productId: string,
  orderId: string
): void {
  const planId = productToPlanMap.get(productId);

  if (!planId) {
    console.warn(`[PURCHASE] Unknown product ID: ${productId}`);
    return;
  }

  const purchase: Purchase = {
    oderId: orderId,
    customerId,
    productId,
    planId,
    purchasedAt: new Date(),
    status: "active",
  };

  const existingPurchases = purchaseStore.get(customerId) || [];

  // Check if already purchased this plan
  const alreadyPurchased = existingPurchases.some(
    (p) => p.planId === planId && p.status === "active"
  );

  if (alreadyPurchased) {
    console.log(`[PURCHASE] Customer ${customerId} already owns ${planId} plan`);
    return;
  }

  existingPurchases.push(purchase);
  purchaseStore.set(customerId, existingPurchases);

  console.log(`[PURCHASE] Recorded: ${customerId} purchased ${planId} plan`);
}

/**
 * Gets all purchases for a customer.
 */
export function getCustomerPurchases(customerId: string): Purchase[] {
  return purchaseStore.get(customerId) || [];
}

/**
 * Gets the plan IDs that a customer has already purchased.
 */
export function getPurchasedPlanIds(customerId: string): PlanId[] {
  const purchases = purchaseStore.get(customerId) || [];
  return purchases
    .filter((p) => p.status === "active")
    .map((p) => p.planId);
}

/**
 * Checks if a customer has already purchased a specific plan.
 */
export function hasPurchasedPlan(customerId: string, planId: PlanId): boolean {
  const purchases = purchaseStore.get(customerId) || [];
  return purchases.some((p) => p.planId === planId && p.status === "active");
}

/**
 * Revokes/cancels a purchase (for refunds, fraud, etc.)
 */
export function revokePurchase(customerId: string, planId: PlanId): void {
  const purchases = purchaseStore.get(customerId) || [];
  const purchase = purchases.find(
    (p) => p.planId === planId && p.status === "active"
  );

  if (purchase) {
    purchase.status = "revoked";
    console.log(`[PURCHASE] Revoked: ${customerId}'s ${planId} plan`);
  }
}

/**
 * Called when a subscription becomes active.
 * This is THE moment to grant the user access to paid features.
 *
 * @param customerId - The Polar customer ID (maps to your user)
 * @param productId - The Polar product ID
 * @param subscriptionId - The subscription ID (used as order ID)
 */
export function onSubscriptionActive(
  customerId: string,
  productId?: string,
  subscriptionId?: string
): void {
  // Record the purchase
  if (productId && subscriptionId) {
    recordPurchase(customerId, productId, subscriptionId);
  }
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  🎉 SUBSCRIPTION ACTIVATED                 ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Customer: ${customerId.padEnd(30)}║`);
  console.log("║                                            ║");
  console.log("║  TODO in production:                       ║");
  console.log("║  • db.users.update({ polarId }, { pro })   ║");
  console.log("║  • Enable premium features                 ║");
  console.log("║  • Send welcome email                      ║");
  console.log("╚════════════════════════════════════════════╝\n");
}

/**
 * Called when a subscription is canceled.
 * User might still have access until the end of the billing period.
 *
 * @param customerId - The Polar customer ID
 */
export function onSubscriptionCanceled(customerId: string): void {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  ⚠️  SUBSCRIPTION CANCELED                 ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Customer: ${customerId.padEnd(30)}║`);
  console.log("║                                            ║");
  console.log("║  TODO in production:                       ║");
  console.log("║  • Mark subscription as 'canceling'        ║");
  console.log("║  • Schedule access revocation for end date ║");
  console.log("║  • Send 'sorry to see you go' email        ║");
  console.log("╚════════════════════════════════════════════╝\n");
}

/**
 * Called when a subscription is immediately revoked.
 * Access should be removed RIGHT NOW.
 *
 * @param customerId - The Polar customer ID
 */
export function onSubscriptionRevoked(customerId: string): void {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  🚫 SUBSCRIPTION REVOKED                   ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Customer: ${customerId.padEnd(30)}║`);
  console.log("║                                            ║");
  console.log("║  TODO in production:                       ║");
  console.log("║  • IMMEDIATELY revoke access               ║");
  console.log("║  • Log for fraud investigation             ║");
  console.log("╚════════════════════════════════════════════╝\n");
}
