import React, { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiKeyProvider, useApiKey } from '../context/ApiKeyContext';

// Consumer component that displays the current apiKey
function ApiKeyDisplay() {
  const { apiKey } = useApiKey();
  return <div data-testid="api-key">{apiKey}</div>;
}

// Consumer component that immediately calls setApiKey on mount
function ApiKeySetter({ value }: { value: string }) {
  const { setApiKey } = useApiKey();
  useEffect(() => {
    setApiKey(value);
  }, [setApiKey, value]);
  return null;
}

describe('ApiKeyContext', () => {
  describe('initial state', () => {
    it('returns an empty string for apiKey initially', () => {
      render(
        <ApiKeyProvider>
          <ApiKeyDisplay />
        </ApiKeyProvider>,
      );
      expect(screen.getByTestId('api-key')).toHaveTextContent('');
    });
  });

  describe('setApiKey', () => {
    it('updates apiKey to the provided value', async () => {
      render(
        <ApiKeyProvider>
          <ApiKeySetter value="sk-abc" />
          <ApiKeyDisplay />
        </ApiKeyProvider>,
      );
      // After the setter fires the key should be reflected
      expect(await screen.findByText('sk-abc')).toBeInTheDocument();
    });
  });

  describe('storage isolation', () => {
    beforeEach(() => {
      jest.spyOn(Storage.prototype, 'setItem');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('never writes the API key to localStorage', async () => {
      render(
        <ApiKeyProvider>
          <ApiKeySetter value="sk-abc" />
        </ApiKeyProvider>,
      );
      // Wait a tick for useEffect to run
      await act(async () => {});
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('never writes the API key to sessionStorage', async () => {
      render(
        <ApiKeyProvider>
          <ApiKeySetter value="sk-abc" />
        </ApiKeyProvider>,
      );
      await act(async () => {});
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
