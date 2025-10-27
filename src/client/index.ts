import {
  type FunctionReference,
  type GenericDataModel,
  type GenericMutationCtx,
  type HttpRouter,
  createFunctionHandle,
  httpActionGeneric,
  internalMutationGeneric,
} from "convex/server";
import type { Mounts } from "../component/_generated/api.js";
import type { RunQueryCtx, UseApi } from "./types.js";
import { WorkOS, type Event as WorkOSEvent } from "@workos-inc/node";
import type { SetRequired } from "type-fest";
import { v } from "convex/values";

type Options = {
  authFunctions?: AuthFunctions;
  clientId?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  webhookPath?: string;
  additionalEventTypes?: WorkOSEvent["event"][];
  logLevel?: "DEBUG";
};
type Config = SetRequired<
  Options,
  "clientId" | "apiKey" | "apiSecret" | "webhookSecret"
>;

export type AuthFunctions = {
  authKitOnEvent?: FunctionReference<
    "mutation",
    "internal",
    { event: string; data: unknown },
    null
  >;
};

// UseApi<typeof api> is an alternative that has jump-to-definition but is
// less stable and reliant on types within the component files, which can cause
// issues where passing `components.foo` doesn't match the argument
export type WorkOSAuthKitComponent = UseApi<Mounts>;

export class AuthKit<DataModel extends GenericDataModel> {
  public workos: WorkOS;
  private config: Config;
  constructor(
    public component: WorkOSAuthKitComponent,
    public options?: Options
  ) {
    const clientId = options?.clientId ?? process.env.WORKOS_CLIENT_ID;
    const apiKey = options?.apiKey ?? process.env.WORKOS_API_KEY;
    const apiSecret = options?.apiSecret ?? process.env.WORKOS_SECRET;
    const webhookSecret =
      options?.webhookSecret ?? process.env.WORKOS_WEBHOOK_SECRET;
    if (!clientId) {
      throw new Error("WORKOS_CLIENT_ID is not set");
    }
    if (!apiKey) {
      throw new Error("WORKOS_API_KEY is not set");
    }
    if (!apiSecret) {
      throw new Error("WORKOS_SECRET is not set");
    }
    if (!webhookSecret) {
      throw new Error("WORKOS_WEBHOOK_SECRET is not set");
    }
    this.config = {
      ...options,
      clientId,
      apiKey,
      apiSecret,
      webhookSecret,
      webhookPath: options?.webhookPath ?? "/workos/webhook",
    };
    this.workos = new WorkOS(this.config.apiKey);
  }
  async getAuthUser(ctx: RunQueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return ctx.runQuery(this.component.lib.getAuthUser, {
      id: identity.subject,
    });
  }
  onEvent(
    handler: (
      ctx: GenericMutationCtx<DataModel>,
      args: WorkOSEvent
    ) => Promise<void>
  ) {
    return {
      authKitOnEvent: internalMutationGeneric({
        args: {
          event: v.string(),
          data: v.any(),
        },
        returns: v.null(),
        handler: async (ctx, args) => {
          await handler(ctx, args as unknown as WorkOSEvent);
        },
      }),
    };
  }
  registerRoutes(http: HttpRouter) {
    http.route({
      path: "/workos/webhook",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const payload = await request.text();
        const sigHeader = request.headers.get("workos-signature");
        if (!sigHeader) {
          throw new Error("No signature header");
        }
        const secret = this.config.webhookSecret;
        if (!secret) {
          throw new Error("webhook secret is not set");
        }
        const event = await this.workos.webhooks.constructEvent({
          payload: JSON.parse(payload),
          sigHeader: sigHeader,
          secret,
        });
        if (this.config.logLevel === "DEBUG") {
          console.log("received event", event);
        }
        await ctx.runMutation(this.component.lib.enqueueWebhookEvent, {
          apiKey: this.config.apiKey,
          eventId: event.id,
          event: event.event,
          onEventHandle: this.config.authFunctions?.authKitOnEvent
            ? await createFunctionHandle(
                this.config.authFunctions.authKitOnEvent
              )
            : undefined,
          updatedAt:
            "updated_at" in event ? (event.updated_at as string) : undefined,
          eventTypes: this.config.additionalEventTypes,
        });
        return new Response("OK", { status: 200 });
      }),
    });
  }
}
