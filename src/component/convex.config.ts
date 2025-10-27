import { defineComponent } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const component = defineComponent("workOSAuthKit");

component.use(workpool, { name: "webhookWorkpool" });

export default component;
