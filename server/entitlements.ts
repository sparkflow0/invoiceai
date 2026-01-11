import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { getFirestore } from "./firebase-admin";

export type PlanTier = "free" | "pro";

export type Entitlement = {
  plan: PlanTier;
  status?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean | null;
};

const MEMORY_ENTITLEMENTS = new Map<string, Entitlement>();

export async function getUserEntitlement(userId: string | null | undefined): Promise<Entitlement> {
  if (!userId) {
    return { plan: "free" };
  }

  const firestore = getFirestore();
  if (!firestore) {
    return MEMORY_ENTITLEMENTS.get(userId) ?? { plan: "free" };
  }

  const doc = await firestore.collection("users").doc(userId).get();
  if (!doc.exists) {
    return { plan: "free" };
  }

  const data = doc.data() as Entitlement | undefined;
  return {
    plan: data?.plan ?? "free",
    status: data?.status ?? null,
    stripeCustomerId: data?.stripeCustomerId ?? null,
    stripeSubscriptionId: data?.stripeSubscriptionId ?? null,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: data?.cancelAtPeriodEnd ?? null,
  };
}

export async function upsertUserEntitlement(userId: string, patch: Entitlement) {
  const firestore = getFirestore();
  if (!firestore) {
    MEMORY_ENTITLEMENTS.set(userId, { ...(MEMORY_ENTITLEMENTS.get(userId) ?? { plan: "free" }), ...patch });
    return;
  }

  await firestore.collection("users").doc(userId).set(
    {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function findUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const firestore = getFirestore();
  if (!firestore) {
    for (const [userId, entitlement] of Array.from(MEMORY_ENTITLEMENTS.entries())) {
      if (entitlement.stripeCustomerId === customerId) return userId;
    }
    return null;
  }

  const snapshot = await firestore
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

export async function applyStripeSubscriptionUpdate(
  userId: string,
  subscription: Stripe.Subscription,
) {
  const status = subscription.status;
  const plan: PlanTier = status === "active" || status === "trialing" ? "pro" : "free";

  await upsertUserEntitlement(userId, {
    plan,
    status,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: subscription.current_period_end
      ? subscription.current_period_end * 1000
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
  });
}
