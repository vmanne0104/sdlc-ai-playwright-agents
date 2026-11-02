import { test as base, expect, APIRequestContext, APIResponse } from '@playwright/test';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type CallOptions = { data?: unknown; headers?: Record<string, string>; params?: Record<string, string | number> };

const redact = (h: Record<string, string> = {}) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k, /authorization|token|cookie|api-key/i.test(k) ? '***REDACTED***' : v]));

/** Thin client that logs every request/response (redacting secrets). */
export class ApiClient {
  readonly log: string[] = [];
  constructor(private readonly request: APIRequestContext) {}

  async call(method: Method, url: string, opts: CallOptions = {}): Promise<APIResponse> {
    const started = Date.now();
    this.log.push(`--> ${method} ${url}`);
    if (opts.params) this.log.push(`    params: ${JSON.stringify(opts.params)}`);
    if (opts.headers) this.log.push(`    headers: ${JSON.stringify(redact(opts.headers))}`);
    if (opts.data !== undefined) this.log.push(`    body: ${JSON.stringify(opts.data)}`);
    const res = await this.request.fetch(url, { method, ...opts });
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    this.log.push(`<-- ${res.status()} ${res.statusText()} (${Date.now() - started} ms)`);
    this.log.push(`    response: ${body.length > 2000 ? body.slice(0, 2000) + '…[truncated]' : body}`, '');
    return res;
  }
  get = (u: string, o?: CallOptions) => this.call('GET', u, o);
  post = (u: string, o?: CallOptions) => this.call('POST', u, o);
  put = (u: string, o?: CallOptions) => this.call('PUT', u, o);
  patch = (u: string, o?: CallOptions) => this.call('PATCH', u, o);
  delete = (u: string, o?: CallOptions) => this.call('DELETE', u, o);
}

export const test = base.extend<{ api: ApiClient }>({
  api: async ({ request }, use, testInfo) => {
    const client = new ApiClient(request);
    await use(client);
    // Evidence for API tests (the API equivalent of a screenshot)
    await testInfo.attach('api-log', { body: client.log.join('\n') || '(no API calls)', contentType: 'text/plain' });
  },
});

export { expect };
