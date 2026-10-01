import { EnvHttpProxyAgent, fetch as proxyFetch } from "undici";
const state = globalThis as unknown as { nehirProxy?: EnvHttpProxyAgent };
/** Preserve the managed cloud proxy and inherited CA verification. Never disable TLS. */
export async function outboundFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy
  ) {
    const dispatcher = (state.nehirProxy ??= new EnvHttpProxyAgent());
    return (await proxyFetch(url, { ...init, dispatcher } as Parameters<
      typeof proxyFetch
    >[1])) as unknown as Response;
  }
  return fetch(url, init);
}
