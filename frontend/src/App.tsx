// src/App.tsx
// ============
// This is the main React component for our frontend.
//
// BILLING MENTAL MODEL (CRITICAL):
// --------------------------------
// 1. Frontend NEVER talks to Polar directly
// 2. Frontend NEVER enables subscriptions based on redirects
// 3. Frontend only does TWO things:
//    a) Calls YOUR backend to get a checkout URL
//    b) Redirects user to that URL
//
// The "success page" after checkout is just for UX.
// The REAL subscription activation happens via webhook → backend.

import { useState, useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Card from "./components/Card";
import PaymentStatus from "./components/PaymentStatus";
import "./App.css";

// Backend URL - from environment variable or default to localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Hardcoded customer ID for POC (matches backend)
const CUSTOMER_ID = "poc_user_001";

// Plan IDs that match what backend expects
type PlanId = "pro" | "master";

// Plan display names
const PLAN_NAMES: Record<PlanId, string> = {
  pro: "Pro Plan",
  master: "Master Plan",
};

/**
 * Fetches the list of plans the user has already purchased.
 */
async function fetchPurchasedPlans(): Promise<PlanId[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/purchases/${CUSTOMER_ID}`);
    if (!response.ok) {
      console.error("[Frontend] Failed to fetch purchases");
      return [];
    }
    const data = await response.json();
    return data.purchasedPlans || [];
  } catch (error) {
    console.error("[Frontend] Error fetching purchases:", error);
    return [];
  }
}

/**
 * Calls our backend to create a Polar checkout session.
 * Returns the checkout URL where we redirect the user.
 *
 * WHY GO THROUGH BACKEND?
 * -----------------------
 * If frontend called Polar directly, we'd need to put
 * POLAR_ACCESS_TOKEN in the browser → anyone could steal it!
 *
 * Backend keeps secrets safe and controls what checkouts are created.
 */
async function createCheckout(planId: PlanId): Promise<string> {
  console.log(`[Frontend] Creating checkout for plan: ${planId}`);

  const response = await fetch(`${BACKEND_URL}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create checkout");
  }

  const data = await response.json();
  console.log(`[Frontend] Got checkout URL:`, data.url);
  return data.url;
}

/**
 * Simple URL-based router for the POC.
 * In production, you'd use React Router or similar.
 */
function getRouteFromURL(): { page: "home" | "payment"; status?: string; plan?: string } {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path === "/payment") {
    return {
      page: "payment",
      status: params.get("status") || undefined,
      plan: params.get("plan") || undefined,
    };
  }

  // Also support old /success route for backwards compatibility
  if (path === "/success") {
    return {
      page: "payment",
      status: "success",
      plan: params.get("plan") || undefined,
    };
  }

  return { page: "home" };
}

/**
 * Navigate to home page (clears URL params)
 */
function navigateToHome(): void {
  window.history.pushState({}, "", "/");
  window.location.reload();
}

function App() {
  const [purchasedPlans, setPurchasedPlans] = useState<PlanId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);

  const route = getRouteFromURL();

  // Fetch purchased plans on mount
  useEffect(() => {
    async function loadPurchases() {
      setIsLoading(true);
      const plans = await fetchPurchasedPlans();
      setPurchasedPlans(plans);
      setIsLoading(false);
    }
    loadPurchases();
  }, []);

  /**
   * Handles the "Buy" button click.
   * 1. Creates checkout session via backend
   * 2. Redirects user to Polar's checkout page
   * 3. After payment, Polar redirects to success page
   *
   * IMPORTANT: The redirect to success page does NOT mean payment succeeded!
   * Only the webhook confirms that. The success page is just for UX.
   */
  async function handleBuy(planId: PlanId): Promise<void> {
    // Don't allow buying already purchased plans
    if (purchasedPlans.includes(planId)) {
      alert("You have already purchased this plan!");
      return;
    }

    try {
      setCheckoutLoading(planId);
      console.log(`[Frontend] User clicked Buy for: ${planId}`);

      // Step 1: Ask backend to create checkout session
      const checkoutUrl = await createCheckout(planId);

      // Step 2: Redirect user to Polar's checkout page
      // This takes them OFF your site to complete payment
      console.log(`[Frontend] Redirecting to Polar checkout...`);
      window.location.href = checkoutUrl;

      // After this, the flow is:
      // 1. User completes payment on Polar
      // 2. Polar redirects user to your success URL
      // 3. Polar sends webhook to your backend (THIS is the source of truth)
      // 4. Your backend updates database based on webhook
    } catch (error) {
      setCheckoutLoading(null);
      console.error("[Frontend] Checkout failed:", error);
      alert(
        `Checkout failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Render payment status page
  if (route.page === "payment") {
    const status = route.status as "success" | "cancelled" | "error" || "error";
    const planId = route.plan as PlanId | undefined;
    const planName = planId ? PLAN_NAMES[planId] : "your plan";

    return (
      <>
        <Header />
        <PaymentStatus
          status={status}
          planName={planName}
          onGoBack={navigateToHome}
        />
        <Footer />
      </>
    );
  }

  // Render home page with product cards
  return (
    <>
      <Header />
      <div
        style={{
          display: "flex",
          gap: "2rem",
          justifyContent: "center",
          padding: "2rem",
          flexWrap: "wrap",
        }}
      >
        {/* Pro Plan Card */}
        <Card
          image="/Gemini_Generated_Image_i6sgm1i6sgm1i6sg.png"
          title="Pro Plan"
          onBuy={() => handleBuy("pro")}
          isPurchased={purchasedPlans.includes("pro")}
          isLoading={isLoading || checkoutLoading === "pro"}
        />

        {/* Master Plan Card */}
        <Card
          image="/77e9208e7e3b3c7a00e9fbd4eaddcd3b.jpg"
          title="Master Plan"
          onBuy={() => handleBuy("master")}
          isPurchased={purchasedPlans.includes("master")}
          isLoading={isLoading || checkoutLoading === "master"}
        />
      </div>

      {/* Simple explanation for the POC */}
      <div style={{ textAlign: "center", padding: "1rem", color: "#666" }}>
        <p>Click "Buy" to start checkout with Polar (sandbox mode)</p>
        <p style={{ fontSize: "0.875rem" }}>
          Frontend → Backend → Polar → User pays → Webhook → Backend logs
        </p>
        {purchasedPlans.length > 0 && (
          <p style={{ fontSize: "0.875rem", color: "#4CAF50", marginTop: "0.5rem" }}>
            You own: {purchasedPlans.map(p => PLAN_NAMES[p]).join(", ")}
          </p>
        )}
      </div>

      <Footer />
    </>
  );
}

export default App;
