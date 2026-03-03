import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../app/page';
import '@testing-library/jest-dom';

describe('Home', () => {
  it('renders the search surface', () => {
    render(<Home />);
    expect(
      screen.getByPlaceholderText(
        'Add details like color, style, or price range to refine results',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });
});
