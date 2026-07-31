declare module "cloudflare:workers" {
  export const env: {
    // Cloudflare injects the runtime binding; the generated worker types own its shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DB?: any;
    [key: string]: unknown;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// Kept global for the worker entry until Cloudflare generates environment types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D1Database = any;
