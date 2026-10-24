import { vi } from "vitest";
export const router = {push:vi.fn(),replace:vi.fn(),refresh:vi.fn(),back:vi.fn()};
export const db = {
  from: vi.fn(), rpc: vi.fn(),
  auth: {getUser:vi.fn(),signInWithPassword:vi.fn(),signOut:vi.fn(),updateUser:vi.fn(),resetPasswordForEmail:vi.fn()},
};
export function queryResult(data: unknown, error: {message:string}|null = null, count = 0) {
  const promise = Promise.resolve({data,error,count});
  const methods = ["select","eq","neq","is","not","in","order","range","abortSignal","single","update","insert","delete","gte","lte","lt","or","limit"] as const;
  const query = Object.fromEntries(methods.map(method=>[method,vi.fn()])) as unknown as Record<typeof methods[number],ReturnType<typeof vi.fn>> & {then:typeof promise.then};
  query.then=promise.then.bind(promise);
  for(const method of methods)query[method].mockReturnValue(query);
  return query;
}
