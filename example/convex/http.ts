import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/workos/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text();
    const sigHeader = request.headers.get("workos-signature");
    if (!sigHeader) {
      throw new Error("No signature header");
    }
    await ctx.runAction(internal.webhooks.processWebhook, {
      payload,
      sigHeader,
    });
    return new Response("OK", { status: 200 });
  }),
});

export default http;
