import type { ReportOutcome } from "@/lib/domain/report";

export interface ContactCard {
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string;
  /** Local demo configuration only — no real POS / membership integration. */
  readonly actionHref: string;
}

/**
 * Outcome-based contact cards shown to the customer after release. These are
 * static local demo configuration; there is no SMS, email, or claim-system
 * integration behind them.
 */
export const CONTACT_CARDS: Readonly<Record<ReportOutcome, readonly ContactCard[]>> = {
  no_new_damage_detected: [
    {
      title: "Questions about this result?",
      body: "Our team can walk you through the footage-based findings in person.",
      actionLabel: "Contact the wash",
      actionHref: "tel:+15555550123",
    },
    {
      title: "Thanks for choosing us",
      body: "Show this page at your next visit for a complimentary re-wash.",
      actionLabel: "View membership perks",
      actionHref: "#membership",
    },
  ],
  new_damage_detected: [
    {
      title: "We're here to make this right",
      body: "New damage was identified during your wash. Our manager will help you start a resolution.",
      actionLabel: "Start resolution",
      actionHref: "tel:+15555550123",
    },
    {
      title: "File with your insurer",
      body: "You can share this report's conclusion and any released photos with your provider.",
      actionLabel: "Insurance guidance",
      actionHref: "#insurance",
    },
  ],
  manual_review_required: [
    {
      title: "A specialist is reviewing your claim",
      body: "Some footage needs a closer human look. We'll follow up shortly.",
      actionLabel: "Contact the wash",
      actionHref: "tel:+15555550123",
    },
  ],
};
