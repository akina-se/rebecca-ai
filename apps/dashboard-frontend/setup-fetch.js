const f = globalThis.fetch;
const H = globalThis.Headers;
const Req = globalThis.Request;
const Res = globalThis.Response;

if (typeof global !== 'undefined') {
  global.fetch = f;
  global.Headers = H;
  global.Request = Req;
  global.Response = Res;
}

if (typeof window !== 'undefined') {
  window.fetch = f;
  window.Headers = H;
  window.Request = Req;
  window.Response = Res;
}

if (typeof globalThis !== 'undefined') {
  globalThis.fetch = f;
  globalThis.Headers = H;
  globalThis.Request = Req;
  globalThis.Response = Res;
}
