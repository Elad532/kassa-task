import '@testing-library/jest-dom';
import { apiFetch } from '../lib/apiClient';

// Build a minimal Response-like object that jsdom can use
function makeFakeResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
  } as unknown as Response;
}

describe('apiFetch', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve(makeFakeResponse()));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('x-gemini-key header injection', () => {
    it('sends the x-gemini-key header when apiKey is non-empty', async () => {
      await apiFetch('/api/search', {}, 'sk-abc');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      // callArgs[1] is the RequestInit (headers may be in init.headers or merged)
      const init: RequestInit = callArgs[1];
      const headers = new Headers(init.headers as HeadersInit);
      expect(headers.get('x-gemini-key')).toBe('sk-abc');
    });

    it('does NOT send the x-gemini-key header when apiKey is empty string', async () => {
      await apiFetch('/api/search', {}, '');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const init: RequestInit = callArgs[1];
      const headers = new Headers((init.headers as HeadersInit) ?? {});
      expect(headers.get('x-gemini-key')).toBeNull();
    });
  });
});
