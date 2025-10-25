"use node";

import { Workpool } from "@convex-dev/workpool";
import { WorkOS } from "@workos-inc/node";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const workos = new WorkOS(process.env.WORKOS_API_KEY);
const webhookWorkpool = new Workpool(components.webhookWorkpool, {
  maxParallelism: 1,
});

export const processWebhook = internalAction({
  args: {
    payload: v.string(),
    sigHeader: v.string(),
  },
  handler: async (ctx, args) => {
    const secret = process.env.WORKOS_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("webhook secret is not set");
    }
    const event = await workos.webhooks.constructEvent({
      payload: JSON.parse(args.payload),
      sigHeader: args.sigHeader,
      secret,
    });
    console.log("received event", event);
    await webhookWorkpool.enqueueMutation(ctx, internal.events.checkEvent, {
      eventId: event.id,
      updatedAt:
        "updated_at" in event ? (event.updated_at as string) : undefined,
    });
  },
});

export const updateEvents = internalAction({
  args: {
    cursor: v.optional(
      v.object({
        eventId: v.string(),
        updatedAt: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let nextCursor = args.cursor?.eventId;
    do {
      const { data, listMetadata } = await workos.events.listEvents({
        events: ["user.created", "user.updated", "user.deleted"],
        after: nextCursor,
      });
      for (const event of data) {
        await ctx.runMutation(internal.events.processEvent, {
          event,
        });
      }
      nextCursor = listMetadata.after;
    } while (nextCursor);
  },
});
