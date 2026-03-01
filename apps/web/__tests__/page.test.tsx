import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '../app/page';
import '@testing-library/jest-dom';

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ id: '1', message: 'hello from mock' }),
  })
) as jest.Mock;

describe('Home', () => {
  it('renders a heading with the fetched message', async () => {
    render(<Home />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
        expect(screen.getByRole('heading')).toHaveTextContent('hello from mock');
    });
  });
});
