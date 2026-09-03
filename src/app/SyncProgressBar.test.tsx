// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncProgressBar } from './SyncProgressBar.tsx';
import { globalSyncEventHub } from '../domain/syncEvents.ts';

describe('SyncProgressBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when sync state is idle', () => {
    const { container } = render(<SyncProgressBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders active progress when sync starts and updates with item progress', () => {
    render(<SyncProgressBar />);

    act(() => {
      globalSyncEventHub.notifySyncStart(3);
    });

    expect(screen.getByText(/Syncing inspections/i)).toBeTruthy();
    expect(screen.getByText(/Preparing to sync 3 inspection/i)).toBeTruthy();

    act(() => {
      globalSyncEventHub.notifyItemProgress({
        submissionId: 'sub-1',
        roomIdentifier: 'K.A-205',
        action: 'uploading',
        completed: 0,
        failed: 0,
        total: 3,
      });
    });

    expect(screen.getByText(/Syncing K.A-205 \(1 of 3\)/i)).toBeTruthy();
  });

  it('allows user to dismiss/hide the banner', async () => {
    render(<SyncProgressBar />);

    act(() => {
      globalSyncEventHub.notifySyncStart(2);
    });

    const hideBtn = screen.getByRole('button', { name: /Hide/i });
    await userEvent.click(hideBtn);

    expect(screen.queryByText(/Syncing inspections/i)).toBeNull();
  });

  it('shows completion message when sync finishes', () => {
    render(<SyncProgressBar />);

    act(() => {
      globalSyncEventHub.notifySyncComplete({
        processedCount: 2,
        syncedCount: 2,
        failedCount: 0,
        recoveredStaleCount: 0,
        errors: [],
      });
    });

    expect(screen.getAllByText(/Sync Complete/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/all 2 inspection\(s\) uploaded/i)).toBeTruthy();
  });
});
