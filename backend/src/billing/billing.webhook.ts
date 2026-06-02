

import { Hono } from "hono";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import {
  onSubscriptionActive,
  onSubscriptionCanceled,
  recordPurchase,
} from "./billing.service.js";

export const billingWebhooks = new Hono();

// POST /api/webhooks/polar
// ------------------------
// This endpoint receives webhook events from Polar.
// Polar will POST here whenever subscription events occur.
billingWebhooks.post("/api/webhooks/polar", async (c) => {
  // STEP 1: Get the raw body as a string
  // ------------------------------------
  // We need the EXACT bytes that Polar sent, because the signature
  // is calculated from those exact bytes. If we parse to JSON first,
  // the signature check would fail (JSON.stringify might reorder keys).
  const rawBody = await c.req.text();

  // STEP 2: Get the headers that Polar sends
  // ----------------------------------------
  // Polar uses the Standard Webhooks format which includes these headers:
  // - webhook-id: Unique ID for this webhook delivery
  // - webhook-timestamp: When the webhook was sent (for replay protection)
  // - webhook-signature: The cryptographic signature to verify
  const webhookHeaders = {
    "webhook-id": c.req.header("webhook-id") || "",
    "webhook-timestamp": c.req.header("webhook-timestamp") || "",
    "webhook-signature": c.req.header("webhook-signature") || "",
  };

  // STEP 3: Get the webhook secret
  // ------------------------------
  // This secret is known only to you and Polar.
  // It's used to verify that the webhook really came from Polar.
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[WEBHOOK ERROR] POLAR_WEBHOOK_SECRET is not set!");
    return c.text("Server misconfigured", 500);
  }

  // STEP 4: Verify the signature and parse the event
  // -------------------------------------------------
  // This is CRITICAL for security. Without this, anyone could send fake events.
  //
  // What validateEvent does:
  // 1. Computes HMAC-SHA256 of the body using your secret
  // 2. Compares it to the signature in the header
  // 3. If they match, the webhook is authentic
  // 4. Also checks timestamp to prevent replay attacks
  // 5. Parses the JSON and validates the event structure
  let event;
  try {
    event = validateEvent(rawBody, webhookHeaders, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // Signature didn't match - this is either:
      // 1. A fake webhook from an attacker
      // 2. Wrong webhook secret in your .env
      // 3. Body was modified in transit (rare)
      console.error("[WEBHOOK ERROR] Invalid signature:", error.message);
      return c.text("Invalid signature", 401);
    }
    // Some other error (parsing, etc.)
    console.error("[WEBHOOK ERROR] Failed to process:", error);
    return c.text("Invalid webhook", 400);
  }

  // STEP 5: Route the event to the appropriate handler
  // --------------------------------------------------
  // Now we know the event is authentic. Let's handle it based on type.
  console.log("\n========================================");
  console.log(`[WEBHOOK] Received event: ${event.type}`);
  console.log("========================================");

  switch (event.type) {
    // ============================================
    // SUBSCRIPTION EVENTS - The ones we care about
    // ============================================

    case "subscription.active":
      // User's subscription is now active (payment succeeded)
      // This is when you should grant access to features
      console.log("[WEBHOOK] Subscription is now ACTIVE");
      console.log("  Subscription ID:", event.data.id);
      console.log("  Customer ID:", event.data.customerId);
      console.log("  Product ID:", event.data.productId);
      console.log("  Status:", event.data.status);

      // Call our billing service to handle the activation
      // Pass productId and subscriptionId to record the purchase
      onSubscriptionActive(
        event.data.customerId,
        event.data.productId,
        event.data.id
      );
      break;

    case "subscription.canceled":
      // User canceled their subscription
      // They might still have access until the end of the billing period
      console.log("[WEBHOOK] Subscription CANCELED");
      console.log("  Subscription ID:", event.data.id);
      console.log("  Customer ID:", event.data.customerId);
      console.log("  Cancel at period end:", event.data.cancelAtPeriodEnd);
      console.log("  Ends at:", event.data.endsAt);

      onSubscriptionCanceled(event.data.customerId);
      break;

    case "subscription.created":
      // Subscription was created (but might not be active yet)
      console.log("[WEBHOOK] Subscription CREATED");
      console.log("  Subscription ID:", event.data.id);
      console.log("  Status:", event.data.status);
      break;

    case "subscription.updated":
      // Subscription was updated (plan change, renewal, etc.)
      console.log("[WEBHOOK] Subscription UPDATED");
      console.log("  Subscription ID:", event.data.id);
      console.log("  Status:", event.data.status);
      break;

    case "subscription.revoked":
      // Subscription was revoked (immediate cancellation, fraud, etc.)
      console.log("[WEBHOOK] Subscription REVOKED - Immediate access removal!");
      console.log("  Subscription ID:", event.data.id);
      console.log("  Customer ID:", event.data.customerId);
      // In a real app, immediately revoke access
      break;

    // ============================================
    // CHECKOUT EVENTS - For debugging
    // ============================================

    case "checkout.created":
      console.log("[WEBHOOK] Checkout session created");
      break;

    case "checkout.updated":
      console.log("[WEBHOOK] Checkout updated, status:", event.data.status);
      break;

    // ============================================
    // ORDER EVENTS - For one-time purchases
    // ============================================

    case "order.created":
      console.log("[WEBHOOK] Order created");
      break;

    case "order.paid":
      // One-time purchase completed - record it
      console.log("[WEBHOOK] Order paid!");
      console.log("  Order ID:", event.data.id);
      console.log("  Customer ID:", event.data.customerId);
      console.log("  Product ID:", event.data.productId);

      // Record the purchase for one-time orders
      if (event.data.customerId && event.data.productId) {
        recordPurchase(
          event.data.customerId,
          event.data.productId,
          event.data.id
        );
      }
      break;

    // ============================================
    // DEFAULT - Log unknown events
    // ============================================

    default:
      console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }

  // STEP 6: Always return 200 to acknowledge receipt
  // -------------------------------------------------
  // If you return an error, Polar will retry the webhook.
  // Only return errors if you truly couldn't process the event.
  return c.json({ received: true });
});
