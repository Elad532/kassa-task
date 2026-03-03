import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation before importing NavBar
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock ApiKeyContext so we can spy on setApiKey
const mockSetApiKey = jest.fn();
jest.mock('../context/ApiKeyContext', () => ({
  useApiKey: () => ({ apiKey: '', setApiKey: mockSetApiKey }),
}));

import NavBar from '../components/NavBar';

beforeEach(() => {
  mockSetApiKey.mockClear();
});

describe('NavBar', () => {
  describe('navigation links', () => {
    it('renders an element with text "End User"', () => {
      render(<NavBar />);
      expect(screen.getByText('End User')).toBeInTheDocument();
    });

    it('renders an element with text "Admin"', () => {
      render(<NavBar />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('the "End User" link has href="/"', () => {
      render(<NavBar />);
      const link = screen.getByText('End User').closest('a');
      expect(link).toHaveAttribute('href', '/');
    });

    it('the "Admin" link has href="/admin"', () => {
      render(<NavBar />);
      const link = screen.getByText('Admin').closest('a');
      expect(link).toHaveAttribute('href', '/admin');
    });
  });

  describe('API key input', () => {
    it('has type="password"', () => {
      render(<NavBar />);
      const input = screen.getByPlaceholderText('Gemini API key');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('calls setApiKey from context when the input value changes', () => {
      render(<NavBar />);
      const input = screen.getByPlaceholderText('Gemini API key');
      fireEvent.change(input, { target: { value: 'my-secret-key' } });
      expect(mockSetApiKey).toHaveBeenCalledWith('my-secret-key');
    });
  });
});
