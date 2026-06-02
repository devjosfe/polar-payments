
import "dotenv/config";


// ----------------------------------
import { Hono } from "hono";
import { serve } from "@hono/node-server"; // This is the Node.js adapter for Hono
import { cors } from "hono/cors"; // We need this so frontend can call our API
import { billingWebhooks } from "./billing/billing.webhook.js";
import { billingRpc } from "./rpc/billing.rpc.js";
import {
  initProductPlanMapping,
  getPurchasedPlanIds,
} from "./billing/billing.service.js";

// Initialize product to plan mapping on startup
initProductPlanMapping();


// ---------------------------
const app = new Hono();


app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);


app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "Polar Payments POC Backend",
    env_check: {
      has_polar_token: !!process.env.POLAR_ACCESS_TOKEN,
      has_webhook_secret: !!process.env.POLAR_WEBHOOK_SECRET,
      has_pro_product: !!process.env.POLAR_PRO_PRODUCT_ID,
      has_master_product: !!process.env.POLAR_MASTER_PRODUCT_ID,
    },
  });
});

// Checkout endpoint - frontend calls this when user clicks "Buy"
// This creates a Polar checkout session and returns the URL
app.post("/checkout", billingRpc.createCheckout);

// Purchases endpoint - frontend calls this to check what user has purchased
// Returns list of plan IDs the user has already bought
app.get("/purchases/:customerId", (c) => {
  const customerId = c.req.param("customerId");
  const purchasedPlans = getPurchasedPlanIds(customerId);
  return c.json({ customerId, purchasedPlans });
});

// Webhook endpoint - Polar calls this when subscription events happen
// This is mounted at /api/webhooks/polar
app.route("/", billingWebhooks);


// ------------------------
const port = Number(process.env.PORT) || 3000;


serve(
  {
    fetch: app.fetch,
    port: port,
  },
  (info) => {
    console.log(`
  Server running on: http://localhost:${info.port}

  Routes:
    GET  /                       - Health check
    POST /checkout               - Create checkout session
    GET  /purchases/:customerId  - Get user's purchased plans
    POST /api/webhooks/polar     - Webhook receiver
`);
  }
);
