import { query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import type { DataModel } from "./_generated/dataModel";

const authFunctions: AuthFunctions = internal.example;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
  additionalEventTypes: ["session.created"],
});

export const { authKitOnEvent } = authKit.onEvent(async (ctx, event) => {
  switch (event.event) {
    case "user.created": {
      await ctx.db.insert("users", {
        authId: event.data.id,
        email: event.data.email,
        name: `${event.data.firstName} ${event.data.lastName}`,
      });
      break;
    }
    case "user.updated": {
      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", event.data.id))
        .unique();
      if (!user) {
        throw new Error(`User not found: ${event.data.id}`);
      }
      await ctx.db.patch(user._id, {
        email: event.data.email,
        name: `${event.data.firstName} ${event.data.lastName}`,
      });
      break;
    }
    case "user.deleted": {
      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", event.data.id))
        .unique();
      if (!user) {
        throw new Error(`User not found: ${event.data.id}`);
      }
      await ctx.db.delete(user._id);
      break;
    }
    case "session.created": {
      console.log("onCreateSession", event);
      break;
    }
  }
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx, _args) => {
    const user = await authKit.getAuthUser(ctx);
    return user;
  },
});
