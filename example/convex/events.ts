import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { omit } from "convex-helpers";

export const checkEvent = internalMutation({
  args: {
    eventId: v.string(),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dbEvent = await ctx.db
      .query("events")
      .withIndex("eventId_updatedAt", (q) => {
        if (args.updatedAt) {
          return q.eq("eventId", args.eventId).gte("updatedAt", args.updatedAt);
        }
        return q.eq("eventId", args.eventId);
      })
      .unique();
    if (dbEvent) {
      console.log("event already processed", args.eventId);
      return;
    }
    const cursor = await ctx.db.query("events").order("desc").first();
    await ctx.scheduler.runAfter(0, internal.webhooks.updateEvents, {
      cursor: cursor
        ? {
            eventId: cursor.eventId,
            updatedAt: cursor.updatedAt,
          }
        : undefined,
    });
  },
});

export const processEvent = internalMutation({
  args: {
    event: v.object({
      id: v.string(),
      createdAt: v.string(),
      event: v.string(),
      data: v.record(v.string(), v.any()),
    }),
  },
  handler: async (ctx, args) => {
    console.log("processing event", args.event);
    switch (args.event.event) {
      case "user.created": {
        const authId = args.event.data.id as string;
        const data = omit(args.event.data as any, ["id", "object"]) as any;
        await ctx.db.insert("users", {
          ...data,
          authId,
        });
        break;
      }
      case "user.updated": {
        const user = await ctx.db
          .query("users")
          .withIndex("authId", (q) => q.eq("authId", args.event.data.id))
          .unique();
        if (!user) {
          console.error("user not found", args.event.data);
          return;
        }

        const data = omit(args.event.data as any, ["id", "object"]) as any;
        await ctx.db.patch(user._id, data);
        break;
      }
      case "user.deleted": {
        const user = await ctx.db
          .query("users")
          .withIndex("authId", (q) => q.eq("authId", args.event.data.id))
          .unique();
        if (!user) {
          console.error("user not found", args.event.data);
          return;
        }
        await ctx.db.delete(user._id);
        break;
      }
    }
    await ctx.db.insert("events", {
      eventId: args.event.id,
      updatedAt: args.event.data.updatedAt,
    });
  },
});
