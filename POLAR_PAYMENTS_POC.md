# Polar Payments Integration POC

> A minimal, production-correct proof of concept for integrating Polar payments into a Node.js + Hono backend with a React frontend.

---

## Table of Contents

1. [What Problem Are We Solving?](#what-problem-are-we-solving)
2. [The Billing Mental Model](#the-billing-mental-model)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Checklist](#implementation-checklist)
5. [Step-by-Step Breakdown](#step-by-step-breakdown)
6. [File Structure](#file-structure)
7. [Code Walkthrough](#code-walkthrough)
8. [Security Considerations](#security-considerations)
9. [Testing the Integration](#testing-the-integration)
10. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
11. [Production Checklist](#production-checklist)

---

## What Problem Are We Solving?

### The Challenge

You want to accept payments for your SaaS product. Users should be able to:
- Click "Buy" on your website
- Pay securely
- Get access to premium features

Sounds simple, but there are critical security and reliability concerns:

| Problem | Why It's Hard |
|---------|---------------|
| **Secrets exposure** | If frontend talks to payment provider directly, API keys are exposed |
| **Payment verification** | How do you KNOW payment succeeded? Users can fake success pages |
| **Reliability** | What if user closes browser mid-payment? What if network fails? |
| **Security** | Anyone can POST fake "payment succeeded" data to your server |

### Our Solution

Use **Polar** as the payment provider with a **webhook-based architecture**:

1. Frontend asks backend for a checkout URL (never talks to Polar directly)
2. Backend creates checkout session with Polar (secrets stay on server)
3. User pays on Polar's secure checkout page
4. Polar sends webhook to backend (cryptographically signed proof of payment)
5. Backend verifies signature and updates subscription state

**Webhooks are the single source of truth** - not redirects, not frontend state, not user claims.

---

## The Billing Mental Model

These four rules are NON-NEGOTIABLE for secure billing:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BILLING MENTAL MODEL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Frontend NEVER talks to Polar directly                      │
│     → Secrets would be exposed in browser                       │
│                                                                 │
│  2. Frontend NEVER enables subscriptions                        │
│     → User could fake the "success" state                       │
│                                                                 │
│  3. Backend NEVER trusts redirects                              │
│     → User can manually navigate to success URL                 │
│                                                                 │
│  4. Webhooks are the ONLY source of truth                       │
│     → Cryptographically signed by Polar                         │
│     → Cannot be faked without the secret                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Redirects Lie

After payment, Polar redirects the user to your `successUrl`. But this redirect is NOT proof of payment:

```
❌ WRONG: User lands on /success → Enable premium features

Why it's wrong:
1. User can type yoursite.com/success directly
2. Network can fail before redirect completes
3. User can close browser after payment but before redirect
4. Attacker can share success URL with others
```

```
✅ CORRECT: Webhook arrives → Verify signature → Enable premium features

Why it's right:
1. Webhook is sent server-to-server (user can't intercept)
2. Signature proves it came from Polar
3. Works even if user closes browser
4. Each webhook has unique event ID (no replay attacks)
```

---

## Architecture Overview

```
                                    CHECKOUT FLOW

┌──────────────┐                                              ┌──────────────┐
│              │  1. POST /checkout { planId: "pro" }         │              │
│   FRONTEND   │ ───────────────────────────────────────────> │   BACKEND    │
│   (React)    │                                              │   (Hono)     │
│              │                                              │              │
│  localhost   │  2. Returns { url: "https://polar.sh/..." }  │  localhost   │
│    :5173     │ <─────────────────────────────────────────── │    :3000     │
│              │                                              │              │
└──────────────┘                                              └──────────────┘
       │                                                             │
       │                                                             │
       │ 3. window.location.href = url                               │ Uses Polar SDK
       │    (Redirect to Polar)                                      │ with secret token
       ▼                                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                              POLAR CHECKOUT                                  │
│                         (sandbox.polar.sh/checkout)                          │
│                                                                              │
│                    User enters payment details here                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
       │                                                             │
       │                                                             │
       │ 4. Redirect to successUrl                                   │ 5. POST /api/webhooks/polar
       │    (Just for UX - NOT proof of payment!)                    │    (Signed webhook event)
       ▼                                                             ▼
┌──────────────┐                                              ┌──────────────┐
│              │                                              │              │
│   FRONTEND   │                                              │   BACKEND    │
│   /success   │                                              │   Webhook    │
│              │                                              │   Handler    │
│  "Thanks!"   │                                              │              │
│              │                                              │  ✓ Verify    │
│  (cosmetic)  │                                              │    signature │
│              │                                              │  ✓ Parse     │
│              │                                              │    event     │
│              │                                              │  ✓ Update    │
└──────────────┘                                              │    state     │
                                                              │              │
                                                              └──────────────┘
```

---

## Implementation Checklist

### Billing Integration (Polar)

| Step | Status | File |
|------|--------|------|
| Install @polar-sh/sdk | ✅ Done | `package.json` |
| Configure Polar API credentials in secrets | ✅ Done | `.env` |
| Create webhook endpoint scaffold (`/api/webhooks/polar`) | ✅ Done | `billing.webhook.ts` |
| Set up webhook signature verification | ✅ Done | `billing.webhook.ts` |
| Create billing service stub | ✅ Done | `billing.service.ts` |
| Document Polar integration patterns | ✅ Done | This file |

### Additional Setup

| Step | Status | Details |
|------|--------|---------|
| Polar client initialization | ✅ Done | `polar.client.ts` |
| Plan validation | ✅ Done | `billing.plan.ts` |
| Checkout session creation | ✅ Done | `billing.rpc.ts` |
| Frontend checkout flow | ✅ Done | `App.tsx` |
| CORS configuration | ✅ Done | `index.ts` |
| Health check endpoint | ✅ Done | `index.ts` |

### Purchase Tracking & Payment Status (NEW)

| Step | Status | Details |
|------|--------|---------|
| In-memory purchase store | ✅ Done | `billing.service.ts` - Tracks purchases per customer |
| Record purchases on webhook | ✅ Done | `billing.webhook.ts` - Records on `subscription.active` and `order.paid` |
| Purchases API endpoint | ✅ Done | `GET /purchases/:customerId` in `index.ts` |
| Payment status redirect URLs | ✅ Done | `billing.rpc.ts` - Includes `?status=success&plan=pro` |
| Payment status page | ✅ Done | `PaymentStatus.tsx` - Shows success/cancelled/error |
| Disable purchased products | ✅ Done | `App.tsx` - Fetches purchases and disables bought plans |

---

## Step-by-Step Breakdown

### Step 1: Install Dependencies

```bash
cd backend
npm install @polar-sh/sdk hono @hono/node-server dotenv
```

**Why these packages?**
- `@polar-sh/sdk` - Official Polar SDK with webhook verification built-in
- `hono` - Lightweight web framework (like Express but faster)
- `@hono/node-server` - Adapter to run Hono on Node.js
- `dotenv` - Load secrets from `.env` file

### Step 2: Configure Secrets

Create `.env` in backend root (NEVER commit this file):

```env
# Polar API credentials (get from https://sandbox.polar.sh/settings)
POLAR_ACCESS_TOKEN=polar_oat_xxxxxxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxxxxxx

# Product IDs from your Polar dashboard
POLAR_PRO_PRODUCT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POLAR_MASTER_PRODUCT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Server config
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Why secrets on backend only?**
- Frontend code is sent to user's browser - they can see EVERYTHING
- If `POLAR_ACCESS_TOKEN` was in React, anyone could steal it
- Backend code stays on your server - only you control it

### Step 3: Initialize Polar Client

```typescript
// src/billing/polar.client.ts
import { Polar } from "@polar-sh/sdk";

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox"  // Use "production" for real payments
});
```

**Vendor isolation:** Keep Polar-specific code in one place. If you switch providers, you only change this file.

### Step 4: Create Checkout Endpoint

```typescript
// Backend receives: { planId: "pro" }
// Backend returns: { url: "https://sandbox.polar.sh/checkout/..." }

const session = await polar.checkouts.create({
  products: [productId],
  successUrl: `${frontendUrl}/success`,
  returnUrl: frontendUrl,
});

return { url: session.url };
```

### Step 5: Handle Webhooks (MOST IMPORTANT)

```typescript
// 1. Get raw body (exact bytes Polar sent)
const rawBody = await c.req.text();

// 2. Get Standard Webhooks headers
const webhookHeaders = {
  "webhook-id": c.req.header("webhook-id"),
  "webhook-timestamp": c.req.header("webhook-timestamp"),
  "webhook-signature": c.req.header("webhook-signature"),
};

// 3. Verify signature and parse event
const event = validateEvent(rawBody, webhookHeaders, webhookSecret);

// 4. Handle event
switch (event.type) {
  case "subscription.active":
    // Grant access to premium features
    break;
  case "subscription.canceled":
    // Schedule access revocation
    break;
}

// 5. Return 200 to acknowledge receipt
return { received: true };
```

---

## File Structure

```
backend/
├── .env                    # Secrets (NEVER commit)
├── .env.example            # Template for secrets
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # Server entry point + /purchases endpoint
    └── billing/
        ├── polar.client.ts     # Polar SDK initialization
        ├── billing.plan.ts     # Plan ID validation
        ├── billing.service.ts  # Business logic + purchase store
        └── billing.webhook.ts  # Webhook handler
    └── rpc/
        └── billing.rpc.ts      # Checkout endpoint handler

frontend/
├── package.json
└── src/
    ├── App.tsx             # Main app with checkout logic + purchase checking
    └── components/
        ├── Card.tsx        # Product cards with Buy/Purchased button
        ├── Header.tsx
        ├── Footer.tsx
        └── PaymentStatus.tsx   # Success/cancelled/error page
```

---

## Purchase Tracking & Payment Status

### How It Works

After a successful payment, we need to:
1. **Prevent duplicate purchases** - Users shouldn't buy the same product twice
2. **Show payment feedback** - Clear success/cancelled/error messages

### Purchase Tracking Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PURCHASE TRACKING FLOW                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User completes payment on Polar                                          │
│                    ↓                                                         │
│  2. Polar sends webhook to backend                                           │
│     Event: subscription.active or order.paid                                 │
│                    ↓                                                         │
│  3. Backend records purchase in store                                        │
│     recordPurchase(customerId, productId, orderId)                          │
│                    ↓                                                         │
│  4. Frontend fetches purchases on load                                       │
│     GET /purchases/poc_user_001                                              │
│     Returns: { purchasedPlans: ["pro"] }                                     │
│                    ↓                                                         │
│  5. Frontend disables "Buy" button for purchased plans                       │
│     Shows "Purchased" instead of "Buy"                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Payment Status Redirect

When creating a checkout, we include status info in the redirect URLs:

```typescript
// billing.rpc.ts
const session = await polar.checkouts.create({
  products: [productId],
  successUrl: `${baseUrl}/payment?status=success&plan=${planId}`,
  returnUrl: `${baseUrl}/payment?status=cancelled&plan=${planId}`,
});
```

The frontend reads these URL parameters and shows the appropriate message:
- **success**: "Payment Successful! Your access has been activated."
- **cancelled**: "Payment Cancelled. No payment was made."
- **error**: "Something went wrong while processing your payment."

### Backend Purchase Store (POC)

For this POC, purchases are stored in-memory:

```typescript
// billing.service.ts
const purchaseStore = new Map<string, Purchase[]>();

// Record a purchase
export function recordPurchase(customerId, productId, orderId) {
  // ... stores in memory
}

// Get purchased plan IDs
export function getPurchasedPlanIds(customerId): PlanId[] {
  // ... returns ["pro", "master"] etc.
}
```

**In production**, replace with database calls:
```typescript
// Example with database
export async function recordPurchase(customerId, productId, orderId) {
  await db.purchases.create({
    customerId,
    productId,
    orderId,
    status: 'active',
    createdAt: new Date()
  });
}
```

### Frontend Purchase Checking

On page load, the frontend fetches purchased plans:

```typescript
// App.tsx
useEffect(() => {
  async function loadPurchases() {
    const response = await fetch(`${BACKEND_URL}/purchases/${CUSTOMER_ID}`);
    const data = await response.json();
    setPurchasedPlans(data.purchasedPlans);
  }
  loadPurchases();
}, []);
```

Cards show "Purchased" and disable the button for owned plans:

```tsx
<Card
  title="Pro Plan"
  isPurchased={purchasedPlans.includes("pro")}
  onBuy={() => handleBuy("pro")}
/>
```

---

## Code Walkthrough

### Frontend: Calling Backend for Checkout

```typescript
// App.tsx

// 1. Call YOUR backend (not Polar directly!)
async function createCheckout(planId: "pro" | "master"): Promise<string> {
  const response = await fetch("http://localhost:3000/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId }),
  });

  const data = await response.json();
  return data.url;  // Polar checkout URL
}

// 2. Handle Buy button click
async function handleBuy(planId: "pro" | "master") {
  const checkoutUrl = await createCheckout(planId);
  window.location.href = checkoutUrl;  // Redirect to Polar
}
```

### Backend: Creating Checkout Session

```typescript
// billing.rpc.ts

export const billingRpc = {
  async createCheckout(c: Context) {
    const { planId } = await c.req.json();

    // Validate plan
    if (!isValidPlan(planId)) {
      return c.json({ error: "Invalid plan" }, 400);
    }

    // Map plan to Polar product ID
    const productId = planId === "pro"
      ? process.env.POLAR_PRO_PRODUCT_ID
      : process.env.POLAR_MASTER_PRODUCT_ID;

    // Create checkout session
    const session = await polar.checkouts.create({
      products: [productId],
      successUrl: `${process.env.FRONTEND_URL}/success`,
    });

    return c.json({ url: session.url });
  }
};
```

### Backend: Webhook Handler

```typescript
// billing.webhook.ts

billingWebhooks.post("/api/webhooks/polar", async (c) => {
  const rawBody = await c.req.text();

  const webhookHeaders = {
    "webhook-id": c.req.header("webhook-id") || "",
    "webhook-timestamp": c.req.header("webhook-timestamp") || "",
    "webhook-signature": c.req.header("webhook-signature") || "",
  };

  // Verify signature - CRITICAL for security
  let event;
  try {
    event = validateEvent(
      rawBody,
      webhookHeaders,
      process.env.POLAR_WEBHOOK_SECRET
    );
  } catch (error) {
    return c.text("Invalid signature", 401);
  }

  // Handle verified event
  switch (event.type) {
    case "subscription.active":
      onSubscriptionActive(event.data.customerId);
      break;
    case "subscription.canceled":
      onSubscriptionCanceled(event.data.customerId);
      break;
  }

  return c.json({ received: true });
});
```

---

## Security Considerations

### 1. Webhook Signature Verification

**What it does:** Proves the webhook came from Polar, not an attacker.

**How it works:**
1. Polar computes HMAC-SHA256 of the request body using your shared secret
2. Polar includes this signature in the `webhook-signature` header
3. Your server computes the same HMAC with your copy of the secret
4. If they match, the webhook is authentic

**What happens without it:**
```bash
# Attacker sends fake webhook
curl -X POST https://yourserver.com/api/webhooks/polar \
  -d '{"type": "subscription.active", "data": {"customerId": "attacker"}}'

# Without verification: Attacker gets free premium access!
# With verification: Request rejected (no valid signature)
```

### 2. Timestamp Verification

The Standard Webhooks format includes a timestamp. The SDK rejects webhooks older than 5 minutes, preventing replay attacks.

### 3. Secrets Management

| Secret | Where It Lives | Who Can See It |
|--------|---------------|----------------|
| `POLAR_ACCESS_TOKEN` | Backend `.env` | Only your server |
| `POLAR_WEBHOOK_SECRET` | Backend `.env` | Only your server |
| Product IDs | Backend `.env` | Only your server |

**NEVER put secrets in:**
- Frontend code
- Git repository
- Browser localStorage
- URL parameters

---

## Testing the Integration

### 1. Start the Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Verify Backend is Running

```bash
curl http://localhost:3000/
```

Expected response:
```json
{
  "status": "ok",
  "message": "Polar Payments POC Backend",
  "env_check": {
    "has_polar_token": true,
    "has_webhook_secret": true,
    "has_pro_product": true,
    "has_master_product": true
  }
}
```

### 3. Expose Webhook Endpoint (for testing)

Polar needs to reach your webhook endpoint. Since `localhost` isn't public, use a tunnel:

```bash
# Option 1: localtunnel (free)
npx localtunnel --port 3000

# Option 2: ngrok (free tier available)
ngrok http 3000
```

You'll get a URL like `https://xyz-abc-123.loca.lt`

### 4. Configure Webhook in Polar Dashboard

1. Go to [sandbox.polar.sh](https://sandbox.polar.sh)
2. Navigate to Settings → Webhooks
3. Add endpoint: `https://your-tunnel-url/api/webhooks/polar`
4. Select events: `subscription.active`, `subscription.canceled`
5. Copy the webhook secret to your `.env`

### 5. Test the Full Flow

1. Open `http://localhost:5173` in browser
2. Click "Buy" on Pro Plan
3. Complete checkout on Polar (use test card: `4242 4242 4242 4242`)
4. Watch backend terminal for webhook logs:

```
========================================
[WEBHOOK] Received event: subscription.active
========================================
[WEBHOOK] Subscription is now ACTIVE
  Subscription ID: sub_xxxxx
  Customer ID: cus_xxxxx
  Product ID: prod_xxxxx

╔════════════════════════════════════════════╗
║  🎉 SUBSCRIPTION ACTIVATED                 ║
╠════════════════════════════════════════════╣
║  Customer: cus_xxxxx                       ║
║                                            ║
║  TODO in production:                       ║
║  • db.users.update({ polarId }, { pro })   ║
║  • Enable premium features                 ║
║  • Send welcome email                      ║
╚════════════════════════════════════════════╝
```

---

## Common Pitfalls to Avoid

### ❌ DON'T: Trust the redirect

```typescript
// WRONG - Anyone can visit /success directly
app.get("/success", (req, res) => {
  enablePremiumFeatures(req.user);  // NO!
});
```

### ✅ DO: Trust only webhooks

```typescript
// CORRECT - Only webhook can enable features
webhooks.post("/api/webhooks/polar", async (c) => {
  const event = validateEvent(body, headers, secret);
  if (event.type === "subscription.active") {
    enablePremiumFeatures(event.data.customerId);
  }
});
```

### ❌ DON'T: Skip signature verification

```typescript
// WRONG - Attacker can send fake events
app.post("/webhooks", (req, res) => {
  const event = req.body;  // No verification!
  handleEvent(event);      // Accepting fake data!
});
```

### ✅ DO: Always verify signatures

```typescript
// CORRECT - Only accept verified events
try {
  const event = validateEvent(rawBody, headers, secret);
  handleEvent(event);
} catch {
  return c.text("Invalid signature", 401);
}
```

### ❌ DON'T: Put secrets in frontend

```typescript
// WRONG - Everyone can see this!
const polar = new Polar({
  accessToken: "polar_oat_secret_here"  // Exposed in browser!
});
```

### ✅ DO: Keep secrets on backend

```typescript
// CORRECT - Backend only
// .env file (never committed to git)
POLAR_ACCESS_TOKEN=polar_oat_secret_here

// polar.client.ts (server-side only)
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN
});
```

### ❌ DON'T: Parse JSON before verification

```typescript
// WRONG - Signature is computed from raw bytes
const body = await req.json();  // This changes the bytes!
validateEvent(JSON.stringify(body), ...);  // Will fail!
```

### ✅ DO: Use raw body for verification

```typescript
// CORRECT - Preserve exact bytes
const rawBody = await c.req.text();
validateEvent(rawBody, headers, secret);
```

---

## Production Checklist

Before going live, ensure:

### Security
- [ ] Webhook signature verification is working
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in frontend code
- [ ] No secrets in git history
- [ ] Using HTTPS for webhook endpoint

### Polar Configuration
- [ ] Switch from `sandbox` to `production` in Polar client
- [ ] Update `POLAR_ACCESS_TOKEN` to production token
- [ ] Update `POLAR_WEBHOOK_SECRET` to production secret
- [ ] Update product IDs to production products
- [ ] Configure production webhook URL in Polar dashboard

### Error Handling
- [ ] Webhook failures are logged
- [ ] Checkout failures show user-friendly errors
- [ ] Server has monitoring/alerting

### Database Integration
- [ ] Webhook events update database
- [ ] Customer ID is linked to user account
- [ ] Subscription status is stored persistently
- [ ] Handle duplicate webhook deliveries (idempotency)

### Testing
- [ ] Test successful payment flow
- [ ] Test failed payment flow
- [ ] Test webhook signature rejection
- [ ] Test subscription cancellation

---

## Summary

This POC demonstrates a **production-correct** billing integration pattern:

1. **Secrets stay on backend** - Frontend never sees API tokens
2. **Backend creates checkouts** - Controls what purchases are allowed
3. **Webhooks verify payments** - Cryptographic proof, not trust
4. **Signature verification** - Prevents fake webhook attacks
5. **Purchase tracking** - Prevents duplicate purchases
6. **Payment status feedback** - Clear success/cancelled/error messages

The code is minimal but follows all security best practices. To evolve this into production:

1. Add a database to persist subscription state (replace in-memory store)
2. Link Polar customer IDs to your user accounts (replace hardcoded `poc_user_001`)
3. Add feature gating based on subscription status
4. Add error handling and monitoring
5. Switch from sandbox to production credentials
6. Add proper routing (React Router) instead of URL-based routing

### New Features Added

| Feature | What It Does |
|---------|--------------|
| **In-memory purchase store** | Tracks which customers bought which plans |
| **Purchase recording** | Webhook handler records purchases on `subscription.active` and `order.paid` |
| **Purchases API** | `GET /purchases/:customerId` returns list of purchased plan IDs |
| **Payment status page** | Shows success/cancelled/error with plan name after checkout |
| **Duplicate purchase prevention** | "Buy" button disabled and shows "Purchased" for owned plans |

---

*Generated for Polar Payments POC - December 2024*
