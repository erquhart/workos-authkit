import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { WorkOSAuthKit } from "@convex-dev/workos-authkit";

const workOSAuthKit = new WorkOSAuthKit(components.workOSAuthKit, {});

export const addOne = mutation({
  args: {},
  handler: async (ctx, _args) => {
    await workOSAuthKit.add(ctx, "accomplishments");
  },
});

// Direct re-export of component's API.
export const { add, count } = workOSAuthKit.api();
