import { httpRouter } from "convex/server";
import { authKit } from "./example";

const http = httpRouter();

authKit.registerRoutes(http);

export default http;
