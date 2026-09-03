// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider } from '../../app/router.tsx';
import { FormsPage } from './FormsPage.tsx';

describe('FormsPage', () => {
  it('renders the active Campus Equipment & Facility Inspection form card', () => {
    render(
      <RouterProvider initialPath="/forms">
        <FormsPage />
      </RouterProvider>
    );

    expect(screen.getByText('Inspection Forms')).toBeTruthy();
    expect(screen.getByText('Campus Equipment & Facility Inspection')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Start Inspection Form/i })).toBeTruthy();
  });
});
