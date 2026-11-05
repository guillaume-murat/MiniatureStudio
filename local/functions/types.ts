/** What the local server (`local/server.ts`) hands a function, and what it sends back. */
export interface HandlerEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  body: string | null;
}

export interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

export type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;
