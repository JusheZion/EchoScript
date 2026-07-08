import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  ECHOSCRIPT_CONTAINER: DurableObjectNamespace<EchoScriptContainer>;
  GEMINI_API_KEY: string;
}

export class EchoScriptContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = "10m";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.envVars = {
      NODE_ENV: "production",
      GEMINI_API_KEY: env.GEMINI_API_KEY,
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return getContainer(env.ECHOSCRIPT_CONTAINER).fetch(request);
  },
};
