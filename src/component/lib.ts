import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server.js";
import { components, internal } from "./_generated/api.js";
import { omit, withoutSystemFields } from "convex-helpers";
import { WorkOS, type Event as WorkOSEvent } from "@workos-inc/node";
import type { FunctionHandle } from "convex/server";
import { Workpool } from "@convex-dev/workpool";
import schema from "./schema.js";

const webhookWorkpool = new Workpool(components.webhookWorkpool, {
  maxParallelism: 1,
});

export const enqueueWebhookEvent = mutation({
  args: {
    apiKey: v.string(),
    eventId: v.string(),
    event: v.string(),
    updatedAt: v.optional(v.string()),
    onEventHandle: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    logLevel: v.optional(v.literal("DEBUG")),
  },
  handler: async (ctx, args) => {
    await webhookWorkpool.enqueueMutation(
      ctx,
      internal.lib.processWebhookEvent,
      args
    );
  },
});

export const processWebhookEvent = internalMutation({
  args: {
    apiKey: v.string(),
    eventId: v.string(),
    event: v.string(),
    updatedAt: v.optional(v.string()),
    onEventHandle: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    logLevel: v.optional(v.literal("DEBUG")),
  },
  handler: async (ctx, args) => {
    const dbEvent = await ctx.db
      .query("events")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (dbEvent) {
      console.log("event already processed", args.eventId);
      return;
    }
    const cursor = await ctx.db.query("events").order("desc").first();
    await ctx.db.insert("events", {
      eventId: args.eventId,
      event: args.event,
      updatedAt: args.updatedAt,
    });
    await ctx.scheduler.runAfter(0, internal.lib.updateEvents, {
      apiKey: args.apiKey,
      onEventHandle: args.onEventHandle,
      eventTypes: args.eventTypes,
      logLevel: args.logLevel,
      cursor: cursor
        ? {
            eventId: cursor.eventId,
          }
        : undefined,
    });
  },
});

export const updateEvents = internalAction({
  args: {
    apiKey: v.string(),
    cursor: v.optional(
      v.object({
        eventId: v.string(),
      })
    ),
    onEventHandle: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    logLevel: v.optional(v.literal("DEBUG")),
  },
  handler: async (ctx, args) => {
    const workos = new WorkOS(args.apiKey);
    let nextCursor = args.cursor?.eventId;
    const eventTypes = [
      "user.created" as const,
      "user.updated" as const,
      "user.deleted" as const,
      ...((args.eventTypes as WorkOSEvent["event"][]) ?? []),
    ];
    // No cursor should mean we haven't handled any events - set
    // a start time of 5 minutes ago
    let rangeStart = nextCursor
      ? undefined
      : new Date(Date.now() - 1000 * 60 * 5).toISOString();
    console.log("eventTypes", eventTypes);
    console.log("nextCursor", nextCursor);
    console.log("rangeStart", rangeStart);
    do {
      const { data, listMetadata } = await workos.events.listEvents({
        events: eventTypes,
        after: nextCursor,
        rangeStart,
      });
      console.log("data", data);
      console.log("listMetadata", listMetadata);
      for (const event of data) {
        console.log("processing event", event);
        await ctx.runMutation(internal.lib.processEvent, {
          event,
          logLevel: args.logLevel,
          onEventHandle: args.onEventHandle,
        });
      }
      nextCursor = listMetadata.after;
      rangeStart = undefined;
    } while (nextCursor);
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
    logLevel: v.optional(v.literal("DEBUG")),
    onEventHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("processEvent", args);
    if (args.logLevel === "DEBUG") {
      console.log("processing event", args.event);
    }
    const event = args.event as WorkOSEvent;
    switch (event.event) {
      case "user.created": {
        const data = omit(event.data, ["object"]);
        const existingUser = await ctx.db
          .query("users")
          .withIndex("id", (q) => q.eq("id", data.id))
          .unique();
        if (existingUser) {
          console.warn("user already exists", data.id);
          break;
        }
        await ctx.db.insert("users", data);
        break;
      }
      case "user.updated": {
        const data = omit(event.data, ["object"]);
        const user = await ctx.db
          .query("users")
          .withIndex("id", (q) => q.eq("id", data.id))
          .unique();
        if (!user) {
          console.error("user not found", data.id);
          break;
        }
        if (user.updatedAt >= data.updatedAt) {
          console.warn(`user already updated for event ${event.id}, skipping`);
          break;
        }
        await ctx.db.patch(user._id, data);
        break;
      }
      case "user.deleted": {
        const data = omit(event.data, ["object"]);
        const user = await ctx.db
          .query("users")
          .withIndex("id", (q) => q.eq("id", data.id))
          .unique();
        if (!user) {
          console.warn("user not found", data.id);
          break;
        }
        await ctx.db.delete(user._id);
        break;
      }
    }
    if (args.onEventHandle) {
      await ctx.runMutation(args.onEventHandle as FunctionHandle<"mutation">, {
        event: args.event.event,
        data: args.event.data,
      });
    }
  },
});

export const getAuthUser = query({
  args: {
    id: v.string(),
  },
  returns: v.union(schema.tables.users.validator, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return user ? withoutSystemFields(user) : null;
  },
});
