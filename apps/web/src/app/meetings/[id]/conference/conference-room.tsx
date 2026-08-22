'use client';

import { Display, Microphone, MicrophoneSlash, Video } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackLoop,
  useLocalParticipant,
  useMaybeTrackRefContext,
  useRoomContext,
  useTrackToggle,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { ToggleSource } from '@livekit/components-core';
import type { ReactNode } from 'react';
import '@livekit/components-styles';

export const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'http://localhost:7880';

function LocalParticipantBadge() {
  const trackRef = useMaybeTrackRefContext();
  const { localParticipant } = useLocalParticipant();

  if (
    !trackRef ||
    !localParticipant ||
    trackRef.participant.identity !== localParticipant.identity
  ) {
    return null;
  }

  return (
    <span className="pointer-events-none absolute end-2 top-2 z-10 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
      Это вы
    </span>
  );
}

function ConferenceGrid() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    {
      onlySubscribed: false,
    },
  );

  if (tracks.length === 0) {
    return <p className="text-sm text-muted">Подключение к комнате…</p>;
  }

  return (
    <div className="grid flex-1 auto-rows-fr grid-cols-1 content-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <TrackLoop tracks={tracks}>
        <div className="relative overflow-hidden rounded-lg">
          <ParticipantTile className="h-full w-full" />
          <LocalParticipantBadge />
        </div>
      </TrackLoop>
    </div>
  );
}

interface ControlToggleButtonProps {
  source: ToggleSource;
  label: string;
  children: (enabled: boolean) => ReactNode;
}

function ControlToggleButton({
  source,
  label,
  children,
}: ControlToggleButtonProps) {
  const { toggle, enabled, pending } = useTrackToggle({ source });

  return (
    <Button
      isIconOnly
      size="md"
      variant="secondary"
      aria-label={label}
      aria-pressed={enabled}
      isDisabled={pending}
      onPress={() => void toggle()}
      className="min-h-11 min-w-11 data-[enabled=false]:text-danger"
      data-enabled={enabled}
    >
      {children(enabled)}
    </Button>
  );
}

function LeaveButton() {
  const room = useRoomContext();

  return (
    <Button
      variant="danger-soft"
      size="md"
      aria-label="Покинуть конференцию"
      onPress={() => void room.disconnect()}
      className="min-h-11 px-4"
    >
      Выйти
    </Button>
  );
}

function ConferenceControlBar() {
  return (
    <div className="flex items-center justify-center gap-2 pb-2">
      <ControlToggleButton source={Track.Source.Microphone} label="Микрофон">
        {(enabled) =>
          enabled ? (
            <Microphone className="size-5" aria-hidden />
          ) : (
            <MicrophoneSlash className="size-5" aria-hidden />
          )
        }
      </ControlToggleButton>
      <ControlToggleButton source={Track.Source.Camera} label="Камера">
        {(enabled) => (
          <Video
            className={enabled ? 'size-5' : 'size-5 text-danger'}
            aria-hidden
          />
        )}
      </ControlToggleButton>
      <ControlToggleButton source={Track.Source.ScreenShare} label="Экран">
        {(enabled) => (
          <Display
            className={enabled ? 'size-5 text-accent' : 'size-5'}
            aria-hidden
          />
        )}
      </ControlToggleButton>
      <LeaveButton />
    </div>
  );
}

export interface ConferenceRoomProps {
  token: string;
  onLeave?: () => void;
}

export function ConferenceRoom({ token, onLeave }: ConferenceRoomProps) {
  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      className="flex w-full flex-col gap-3 bg-background p-4"
      style={{ height: '100dvh' }}
      onDisconnected={() => onLeave?.()}
    >
      <ConferenceGrid />
      <ConferenceControlBar />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
