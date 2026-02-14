import { randomUUID } from "node:crypto";

import type { ActionItem } from "@/lib/domain";

import type { RankedRecommendation } from "./recommend";

type BuildActionItemsInput = {
  requirement: string;
  ranked: RankedRecommendation[];
};

export function buildActionItems(input: BuildActionItemsInput): ActionItem[] {
  if (input.ranked.length === 0) {
    return [
      {
        id: randomUUID(),
        priority: "high",
        title: "Add more qualified contacts",
        detail:
          "No call returned enough reliable information. Add more contacts and rerun the investigation.",
      },
      {
        id: randomUUID(),
        priority: "medium",
        title: "Relax one or two constraints",
        detail: `Re-evaluate requirement "${input.requirement}" for overly strict filters like budget or immediate move-in.`,
      },
    ];
  }

  const top = input.ranked[0];
  const second = input.ranked[1];

  const items: ActionItem[] = [
    {
      id: randomUUID(),
      priority: "high",
      title: `Call ${top.contactName} for confirmation`,
      detail: `Verify final rent (${top.monthlyPrice ? `~INR ${top.monthlyPrice}` : "TBD"}), deposit, and viewing schedule.`,
    },
    {
      id: randomUUID(),
      priority: "medium",
      title: "Ask for proof and hidden charges",
      detail:
        "Request photos/videos, exact location pin, agreement terms, and any extra maintenance/food/electricity costs.",
    },
  ];

  if (second) {
    items.push({
      id: randomUUID(),
      priority: "low",
      title: `Keep ${second.contactName} as backup`,
      detail: "If the top option changes price/availability, follow up immediately with this backup option.",
    });
  }

  return items;
}
