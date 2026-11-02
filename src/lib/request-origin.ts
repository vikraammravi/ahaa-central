/** Compare the browser origin with the public Host, even behind Next's internal URL. */
export function hasSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  return request.headers.get("origin") === `${url.protocol}//${request.headers.get("host") || url.host}`;
}
