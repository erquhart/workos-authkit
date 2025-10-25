import { defineApp } from "convex/server";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import workpool from "@convex-dev/workpool/convex.config";

const app = defineApp();
app.use(workOSAuthKit);
app.use(workpool, { name: "webhookWorkpool" });

export default app;
