import { authKit } from "./auth";

export default {
  providers: authKit.getAuthConfigProviders(),
};
