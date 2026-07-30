declare module "cloudflare:workers" {
  export const env: {
    DB?: any;
    [key: string]: unknown;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

type D1Database = any;
