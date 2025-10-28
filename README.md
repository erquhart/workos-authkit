# Convex Durable Workflows

[![npm version](https://badge.fury.io/js/@convex-dev%2Fworkos-authkit.svg?)](https://badge.fury.io/js/@convex-dev%2Fworkos-authkit)

<!-- START: Include on https://convex.dev/components -->

This component is the official way to integrate WorkOS AuthKit authentication with your Convex project.

Features:

- Sync user data from WorkOS to your Convex database reliably and durably.
- Respond to events with Convex functions.

See [example](./example) for a demo of how to incorporate this component into your application.

Open a [GitHub issue](https://github.com/get-convex/workos-authkit/issues) with
any feedback or bugs you find.

## Prerequisites

Follow the [Convex WorkOS AuthKit guide](https://docs.convex.dev/auth/authkit/)
to set up a working project with WorkOS AuthKit.

Then follow the steps below to set up user data syncing and event handling.

## Configure webhooks

User data syncing requires webhooks to be configured in your WorkOS project.

Select Webhooks from the left sidebar in your WorkOS project, and create a new
webhook.

**Endpoint URL**: `https://<your-convex-deployment>.convex.site/workos/webhook`

**Events**: `user.created`, `user.updated`, `user.deleted`

![Webhook configuration](https://raw.githubusercontent.com/get-convex/better-auth/refs/heads/main/assets/webhook-configuration.png)

## Installation

First, add `@convex-dev/workos-authkit` to your Convex project:

```sh
npm install @convex-dev/workos-authkit
```

Then, install the component within your `convex/convex.config.ts` file:

```ts
// convex/convex.config.ts
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workOSAuthKit);
export default app;
```

Finally, create a Convex AuthKit client within your `convex/` folder, and point it
to the installed component:

```ts
// convex/auth.ts
import { AuthKit } from "@convex-dev/workos-authkit";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit);
```

## Usage

User create/update/delete in WorkOS will be automatically synced by the
component.

Use the `getAuthUser` component method to get the current authenticated user
object:

```ts
export const getCurrentUser = query({
  args: {},
  handler: async (ctx, _args) => {
    const user = await authKit.getAuthUser(ctx);
    return user;
  },
});
```

## Events

The AuthKit component can be configured to handle events from WorkOS. This is
useful for running code when a user is created, updated, or deleted in WorkOS,
or in response to any other provided event.

By default the component will handle the following events:

- `user.created`
- `user.updated`
- `user.deleted`

```ts
// convex/auth.ts
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// Get a typed object of internal Convex functions exported by this file
const authFunctions: AuthFunctions = internal.auth;

const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

// create `authKitOnEvent` as a named export
export const { authKitOnEvent } = authKit.onEvent(async (ctx, event) => {
  switch (event.event) {
    case "user.created": {
      // ctx is a mutation context and event.data is typed
      await ctx.db.insert("todoLists", {
        name: `${event.data.firstName}'s Todo List`,
        userId: event.data.id,
      });
      break;
    }
  }
});
```

### Additional event types

The component can handle any WorkOS event type. WorkOS docs provides a [complete
list of events](https://workos.com/docs/events). To handle additional event types,
they must be selected in your webhook configuration and added to your AuthKit
component configuration via the `additionalEventTypes` option.

```ts
// convex/auth.ts
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const authFunctions: AuthFunctions = internal.auth;

const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
  additionalEventTypes: ["session.created", "session.revoked"],
});

export const { authKitOnEvent } = authKit.onEvent(async (ctx, event) => {
  switch (event.event) {
    case "session.created": {
      // do something with the session data
      break;
    }
    case "session.revoked": {
      // do something with the session data
      break;
    }
  }
});
```

## User data

Most apps will need to control their user schema and be able to query directly
against a users table. The AuthKit component has it's own user table with user
data from WorkOS. You can think of this as auth metadata for your users, but
you'll likely want to extend this with additional data from your app.

A common pattern for this is to create your own users table with a reference to
the AuthKit user table, using the user events to do any necessary syncing.

```ts
// convex/auth.ts
import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const authFunctions: AuthFunctions = internal.auth;

const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const { authKitOnEvent } = authKit.onEvent(async (ctx, event) => {
  switch (event.event) {
    case "user.created": {
      await ctx.db.insert("users", {
        authId: event.data.id,
        name: `${event.data.firstName} ${event.data.lastName}`,
        isSubscribed: false,
      });
      return;
    }
    case "user.updated": {
      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", event.data.id))
        .unique();
      if (!user) {
        console.warn(`User not found: ${event.data.id}`);
        return;
      }
      await ctx.db.patch(user._id, {
        name: `${event.data.firstName} ${event.data.lastName}`,
      });
      return;
    }
    case "user.deleted": {
      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", event.data.id))
        .unique();
      if (!user) {
        console.warn(`User not found: ${event.data.id}`);
        return;
      }
      await ctx.db.delete(user._id);
      return;
    }
  }
});
```

<!-- END: Include on https://convex.dev/components -->
