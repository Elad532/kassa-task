import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock apiFetch so we can assert it is called correctly
jest.mock('../lib/apiClient', () => ({
  apiFetch: jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    }),
  ),
}));

import { apiFetch } from '../lib/apiClient';
import SearchSurface from '../components/SearchSurface';

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

// URL.createObjectURL is not available in jsdom — stub it
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
});

beforeEach(() => {
  mockApiFetch.mockClear();
});

// Helper: build a fake File with the given MIME type and byte size
function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

// Helper: get the hidden file input — the implementation must render
// <input type="file" data-testid="file-input" ... />
function getFileInput(): HTMLInputElement {
  return screen.getByTestId('file-input') as HTMLInputElement;
}

describe('SearchSurface', () => {
  describe('submit button state', () => {
    it('is disabled when no image is selected and query is empty', () => {
      render(<SearchSurface />);
      const button = screen.getByRole('button', { name: /search/i });
      expect(button).toBeDisabled();
    });

    it('is enabled when the query input has a non-empty value', async () => {
      render(<SearchSurface />);
      const input = screen.getByPlaceholderText(
        'Add details like color, style, or price range to refine results',
      );
      fireEvent.change(input, { target: { value: 'blue sneakers' } });
      const button = screen.getByRole('button', { name: /search/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('file validation', () => {
    it('shows an error containing "Invalid file type" when a non-image file is selected', async () => {
      render(<SearchSurface />);
      const fileInput = getFileInput();
      const pdfFile = makeFile('doc.pdf', 'application/pdf', 1024);
      fireEvent.change(fileInput, { target: { files: [pdfFile] } });
      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });

    it('shows an error containing "10MB" when a file larger than 10MB is selected', async () => {
      render(<SearchSurface />);
      const fileInput = getFileInput();
      const bigFile = makeFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024);
      fireEvent.change(fileInput, { target: { files: [bigFile] } });
      await waitFor(() => {
        expect(screen.getByText(/10MB/i)).toBeInTheDocument();
      });
    });

    it('shows an image preview after a valid jpeg under 10MB is selected', async () => {
      render(<SearchSurface />);
      const fileInput = getFileInput();
      const validFile = makeFile('photo.jpg', 'image/jpeg', 2 * 1024 * 1024);
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('shows an image preview after a valid jpeg is dropped onto the drop zone', async () => {
      render(<SearchSurface />);
      const dropZone = screen.getByText(/drop image here/i);
      const validFile = makeFile('photo.jpg', 'image/jpeg', 1 * 1024 * 1024);
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [validFile] } });
      fireEvent.drop(dropZone, { dataTransfer: { files: [validFile] } });
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('query input', () => {
    it('has the exact placeholder text', () => {
      render(<SearchSurface />);
      expect(
        screen.getByPlaceholderText(
          'Add details like color, style, or price range to refine results',
        ),
      ).toBeInTheDocument();
    });

    it('shows a character counter displaying "0/500" initially', () => {
      render(<SearchSurface />);
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('shows "500/500" after 500 characters are typed', () => {
      render(<SearchSurface />);
      const input = screen.getByPlaceholderText(
        'Add details like color, style, or price range to refine results',
      );
      const text = 'a'.repeat(500);
      fireEvent.change(input, { target: { value: text } });
      expect(screen.getByText('500/500')).toBeInTheDocument();
    });

    it('truncates pasted text to 500 chars and shows a warning when paste exceeds 500 chars', async () => {
      render(<SearchSurface />);
      const input = screen.getByPlaceholderText(
        'Add details like color, style, or price range to refine results',
      );
      const longText = 'b'.repeat(600);
      fireEvent.paste(input, {
        clipboardData: { getData: () => longText },
      });
      await waitFor(() => {
        // The controlled input value must not exceed 500 chars
        expect((input as HTMLInputElement).value.length).toBeLessThanOrEqual(500);
        // A visible warning about the truncation must appear
        expect(screen.getByText(/truncated/i)).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    it('calls apiFetch with a FormData body containing "image" and "userQuery" fields', async () => {
      render(<SearchSurface />);

      // Select a valid image
      const fileInput = getFileInput();
      const validFile = makeFile('photo.jpg', 'image/jpeg', 1 * 1024 * 1024);
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Type a query
      const input = screen.getByPlaceholderText(
        'Add details like color, style, or price range to refine results',
      );
      fireEvent.change(input, { target: { value: 'blue sneakers' } });

      // Submit
      const button = screen.getByRole('button', { name: /search/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockApiFetch.mock.calls[0];
      const init = callArgs[1] as RequestInit;
      expect(init.body).toBeInstanceOf(FormData);

      const formData = init.body as FormData;
      expect(formData.get('image')).not.toBeNull();
      expect(formData.get('userQuery')).toBe('blue sneakers');
    });
  });
});
