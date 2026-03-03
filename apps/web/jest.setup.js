import '@testing-library/jest-dom'

// jest-environment-jsdom doesn't expose Node 18+'s native fetch globals.
// Tests that mock global.fetch need to return a constructable Response.
if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class Response {
    constructor(_body = null, init = {}) {
      this.ok = true;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers ?? {});
    }
  };
}
