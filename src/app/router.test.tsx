// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, RouterProvider } from './router.tsx';
import { parseRoute } from './routerCore.ts';
import { useRouter } from './routerContext.ts';

describe('Router', () => {
  it('parses routes correctly', () => {
    expect(parseRoute('/')).toEqual({ path: '/' });
    expect(parseRoute('/survey')).toEqual({ path: '/survey' });
    expect(parseRoute('/forms')).toEqual({ path: '/forms' });
    expect(parseRoute('/statistics')).toEqual({ path: '/statistics' });
    expect(parseRoute('/records')).toEqual({ path: '/records', query: '' });
    expect(parseRoute('/records?status=FAILED&zone=V')).toEqual({
      path: '/records',
      query: 'status=FAILED&zone=V',
    });
    expect(parseRoute('/records/sub-123')).toEqual({ path: '/records/:id', id: 'sub-123' });
    expect(parseRoute('/unknown-route')).toEqual({ path: '/' });
  });

  function TestConsumer() {
    const { route, navigate } = useRouter();
    return (
      <div>
        <span data-testid="current-path">{route.path}</span>
        {'id' in route && <span data-testid="record-id">{route.id}</span>}
        <button onClick={() => navigate('/statistics')}>Go to Stats</button>
        <Link href="/records/456">Link to Record</Link>
      </div>
    );
  }

  it('navigates to different routes via navigate and Link', async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider initialPath="/survey">
        <TestConsumer />
      </RouterProvider>
    );

    expect(screen.getByTestId('current-path').textContent).toBe('/survey');

    await user.click(screen.getByRole('button', { name: 'Go to Stats' }));
    expect(screen.getByTestId('current-path').textContent).toBe('/statistics');

    await user.click(screen.getByRole('link', { name: 'Link to Record' }));
    expect(screen.getByTestId('current-path').textContent).toBe('/records/:id');
    expect(screen.getByTestId('record-id').textContent).toBe('456');
  });
});

