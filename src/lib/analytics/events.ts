import posthog from "posthog-js";

function isBrowser() {
  return typeof window !== "undefined";
}

// ─── User Identity ───

export function identifyUser(
  userId: string,
  properties?: Record<string, unknown>
) {
  if (!isBrowser()) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!isBrowser()) return;
  posthog.reset();
}

// ─── Auth Events ───

export function trackSignUp(userId: string, email: string, plan: string) {
  identifyUser(userId, {
    email,
    plan,
    signed_up_at: new Date().toISOString(),
  });
  posthog.capture("user_signed_up", { plan });
}

export function trackSignIn(userId: string, email: string) {
  identifyUser(userId, { email });
  posthog.capture("user_signed_in");
}

// ─── Connection Events ───

export function trackConnectionCreated(platform: string) {
  posthog.capture("connection_created", { platform });
}

export function trackConnectionFailed(platform: string, errorCode?: string) {
  posthog.capture("connection_failed", { platform, error_code: errorCode });
}

// ─── Portal Events ───

export function trackPortalCreated(props: {
  surfaceType: string;
  accessType: string;
  platform: string;
  pricingType: string;
}) {
  posthog.capture("portal_created", props);
}

export function trackPortalShared(method: "magic_link" | "product_url") {
  posthog.capture("portal_shared", { method });
}

// ─── Client-Facing Events ───

export function trackClientPortalViewed(
  portalId: string,
  platform: string
) {
  posthog.capture("client_portal_viewed", {
    portal_id: portalId,
    platform,
  });
}

// ─── Billing Events ───

export function trackStripeConnected() {
  posthog.capture("stripe_connected");
}

export function trackPaidPortalCreated(priceCents: number) {
  posthog.capture("paid_portal_created", { price_cents: priceCents });
}
