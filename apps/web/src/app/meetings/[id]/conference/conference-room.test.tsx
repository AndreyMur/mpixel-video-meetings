import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from 'livekit-client';
import { ConferenceRoom, LIVEKIT_URL } from './conference-room';

const lk = vi.hoisted(() => {
  const store = {
    tracks: [] as Array<{ participant: { identity: string }; source: string }>,
    localIdentity: 'me-identity',
    enabled: {} as Record<string, boolean>,
    toggles: {} as Record<string, ReturnType<typeof vi.fn>>,
    disconnect: vi.fn(),
  };

  const reset = () => {
    store.tracks.length = 0;
    store.localIdentity = 'me-identity';
    for (const key of Object.keys(store.enabled)) {
      delete store.enabled[key];
    }
    for (const key of Object.keys(store.toggles)) {
      delete store.toggles[key];
    }
    store.disconnect.mockReset();
  };

  const getToggle = (source: string) => {
    if (!store.toggles[source]) {
      store.toggles[source] = vi.fn().mockResolvedValue(undefined);
    }
    return store.toggles[source];
  };

  const useTrackToggle = vi.fn(({ source }: { source: string }) => ({
    toggle: getToggle(source),
    enabled: Boolean(store.enabled[source]),
    pending: false,
  }));

  return { ...store, reset, getToggle, useTrackToggle };
});

vi.mock('@livekit/components-react', async () => {
  const React = await import('react');
  const TrackRefContext = React.createContext<{
    participant: { identity: string };
    source: string;
  } | null>(null);

  return {
    LiveKitRoom({
      children,
      token,
      serverUrl,
    }: {
      children: React.ReactNode;
      token: string;
      serverUrl: string;
    }) {
      return (
        <div
          data-testid="lk-room"
          data-token={token}
          data-server-url={serverUrl}
        >
          {children}
        </div>
      );
    },
    ParticipantTile() {
      return <div data-testid="participant-tile" />;
    },
    RoomAudioRenderer() {
      return null;
    },
    TrackLoop({
      tracks,
      children,
    }: {
      tracks: Array<{ participant: { identity: string }; source: string }>;
      children: React.ReactNode;
    }) {
      return (
        <>
          {tracks.map((trackRef, index) => (
            <TrackRefContext.Provider key={index} value={trackRef}>
              {children}
            </TrackRefContext.Provider>
          ))}
        </>
      );
    },
    useMaybeTrackRefContext: () => React.useContext(TrackRefContext),
    useLocalParticipant: () => ({
      localParticipant: { identity: lk.localIdentity },
    }),
    useTrackToggle: lk.useTrackToggle,
    useRoomContext: () => ({ disconnect: lk.disconnect }),
    useTracks: () => lk.tracks,
  };
});

beforeEach(() => {
  lk.reset();
});

describe('ConferenceRoom', () => {
  it('connects the LiveKit room with the given token and server url', () => {
    render(<ConferenceRoom token="room-token" />);

    const room = screen.getByTestId('lk-room');
    expect(room).toHaveAttribute('data-token', 'room-token');
    expect(room).toHaveAttribute('data-server-url', LIVEKIT_URL);
  });

  it('shows a connecting hint when there are no participants yet', () => {
    render(<ConferenceRoom token="room-token" />);

    expect(screen.getByText('Подключение к комнате…')).toBeInTheDocument();
    expect(screen.queryByTestId('participant-tile')).not.toBeInTheDocument();
  });

  it('renders tiles for every participant and marks the local one', () => {
    lk.tracks = [
      {
        participant: { identity: 'me-identity' },
        source: Track.Source.Camera,
      },
      {
        participant: { identity: 'remote-1' },
        source: Track.Source.Camera,
      },
    ];

    render(<ConferenceRoom token="room-token" />);

    expect(screen.getAllByTestId('participant-tile')).toHaveLength(2);
    expect(screen.getAllByText('Это вы')).toHaveLength(1);
  });

  it('does not show the local badge when only remote participants are present', () => {
    lk.tracks = [
      {
        participant: { identity: 'remote-1' },
        source: Track.Source.Camera,
      },
    ];

    render(<ConferenceRoom token="room-token" />);

    expect(screen.getByTestId('participant-tile')).toBeInTheDocument();
    expect(screen.queryByText('Это вы')).not.toBeInTheDocument();
  });

  it('toggles the microphone on click', async () => {
    render(<ConferenceRoom token="room-token" />);

    const micButton = screen.getByRole('button', { name: 'Микрофон' });
    expect(micButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(micButton);

    await waitFor(() =>
      expect(lk.getToggle(Track.Source.Microphone)).toHaveBeenCalledTimes(1),
    );
  });

  it('marks the camera button as pressed when the camera is enabled', () => {
    lk.enabled[Track.Source.Camera] = true;

    render(<ConferenceRoom token="room-token" />);

    expect(screen.getByRole('button', { name: 'Камера' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('disconnects the room when the leave button is clicked', async () => {
    render(<ConferenceRoom token="room-token" />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Покинуть конференцию' }),
    );

    await waitFor(() => expect(lk.disconnect).toHaveBeenCalledTimes(1));
  });
});
