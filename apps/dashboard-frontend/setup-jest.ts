import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();

// Polyfill global fetch in jsdom
if (typeof globalThis.fetch !== 'undefined') {
  (global as any).fetch = globalThis.fetch;
  (global as any).Headers = globalThis.Headers;
  (global as any).Request = globalThis.Request;
  (global as any).Response = globalThis.Response;
  if (typeof window !== 'undefined') {
    (window as any).fetch = globalThis.fetch;
    (window as any).Headers = globalThis.Headers;
    (window as any).Request = globalThis.Request;
    (window as any).Response = globalThis.Response;
  }
}

// Jasmine matchers extension for Jest
expect.extend({
  toBeTrue(received: unknown) {
    const pass = received === true;
    return {
      pass,
      message: () => `expected ${received} to be true`,
    };
  },
  toBeFalse(received: unknown) {
    const pass = received === false;
    return {
      pass,
      message: () => `expected ${received} to be false`,
    };
  },
});

function wrapSpyWithJasmineAnd(fn: any) {
  fn.and = {
    returnValue: (val: any) => {
      fn.mockReturnValue(val);
      return fn;
    },
    returnValues: (...vals: any[]) => {
      vals.forEach((v) => fn.mockReturnValueOnce(v));
      return fn;
    },
    callFake: (impl: any) => {
      fn.mockImplementation(impl);
      return fn;
    },
    callThrough: () => fn,
    stub: () => fn,
  };
  return fn;
}

// Jasmine-to-Jest compatibility layer
if (typeof (global as any).jasmine === 'undefined') {
  (global as any).jasmine = {
    createSpyObj: (baseName: string, methodNames: string[] | Record<string, any>, propertyNames?: Record<string, any>) => {
      const obj: any = {};
      if (Array.isArray(methodNames)) {
        for (const method of methodNames) {
          obj[method] = wrapSpyWithJasmineAnd(jest.fn());
        }
      } else if (typeof methodNames === 'object' && methodNames !== null) {
        for (const [key, val] of Object.entries(methodNames)) {
          const fn = typeof val === 'function' ? jest.fn(val) : jest.fn().mockReturnValue(val);
          obj[key] = wrapSpyWithJasmineAnd(fn);
        }
      }
      if (propertyNames) {
        for (const [key, value] of Object.entries(propertyNames)) {
          obj[key] = value;
        }
      }
      return obj;
    },
    createSpy: (name?: string) => wrapSpyWithJasmineAnd(jest.fn()),
    stringMatching: (expected: string | RegExp) => expect.stringMatching(expected),
    objectContaining: (sample: Record<string, any>) => expect.objectContaining(sample),
    any: (expectedClass: any) => expect.any(expectedClass),
    anything: () => expect.anything(),
  };
}

if (typeof (global as any).spyOn === 'undefined') {
  (global as any).spyOn = (object: any, method: string) => {
    const spy = jest.spyOn(object, method as any);
    return wrapSpyWithJasmineAnd(spy);
  };
}

if (typeof (global as any).expectAsync === 'undefined') {
  (global as any).expectAsync = (actualPromise: Promise<any>) => ({
    toBeResolved: async () => {
      try {
        await actualPromise;
        expect(true).toBe(true);
      } catch (err) {
        expect(err).toBeUndefined();
      }
    },
    toBeRejected: async () => {
      try {
        await actualPromise;
        expect('Promise resolved').toBe('Promise should reject');
      } catch (err) {
        expect(err).toBeDefined();
      }
    },
  });
}
