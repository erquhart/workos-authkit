import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { WorkOSAuthKit } from "@convex-dev/workos-authkit";

const workOSAuthKit = new WorkOSAuthKit(components.workOSAuthKit, {});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx, _args) => {
    const user = await ctx.auth.getUserIdentity();
    return user;
  },
});

export const addOne = mutation({
  args: {},
  handler: async (ctx, _args) => {
    await workOSAuthKit.add(ctx, "accomplishments");
  },
});

// Direct re-export of component's API.
export const { add, count } = workOSAuthKit.api();
