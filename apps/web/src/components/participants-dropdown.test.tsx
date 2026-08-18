import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, toast } from '@heroui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/auth';
import { ParticipantsDropdown } from '@/components/participants-dropdown';

const { replaceMock, routerMock } = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    replaceMock: replace,
    routerMock: { push: vi.fn(), replace },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const authMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAccessToken: authMocks.getAccessToken,
    clearAccessToken: authMocks.clearAccessToken,
  };
});

const meetingsMocks = vi.hoisted(() => ({
  sendMeetingInvitation: vi.fn(),
}));

vi.mock('@/lib/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/meetings')>();
  return {
    ...actual,
    sendMeetingInvitation: meetingsMocks.sendMeetingInvitation,
  };
});

const participants = ['user@example.com', 'b@example.com'];

const meeting = {
  id: 'm1',
  title: 'Синк',
  description: null,
  date: '2026-08-20T10:00:00.000Z',
  participants,
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

function renderDropdown(
  props: Partial<Parameters<typeof ParticipantsDropdown>[0]> = {},
) {
  return render(
    <>
      <Toast.Provider />
      <ParticipantsDropdown
        meetingId="m1"
        participants={participants}
        isOrganizer
        ownEmail="user@example.com"
        {...props}
      />
    </>,
  );
}

beforeEach(() => {
  replaceMock.mockClear();
  authMocks.getAccessToken.mockReset().mockReturnValue('token-1');
  authMocks.clearAccessToken.mockReset();
  meetingsMocks.sendMeetingInvitation.mockReset().mockResolvedValue(meeting);
});

afterEach(() => {
  toast.clear();
  vi.clearAllMocks();
});

describe('ParticipantsDropdown', () => {
  it('opens the dropdown and shows every participant email', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );

    expect(
      screen.getByRole('menuitem', { name: /user@example\.com/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /b@example\.com/ }),
    ).toBeInTheDocument();
  });

  it('marks the organizer email as the current user and disables sending to it', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );

    const ownItem = screen.getByRole('menuitem', {
      name: /user@example\.com/,
    });
    expect(ownItem).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Это вы')).toBeInTheDocument();

    await user.click(ownItem);
    expect(
      screen.queryByRole('heading', { name: 'Отправить приглашение?' }),
    ).not.toBeInTheDocument();
  });

  it('opens the confirmation dialog when the organizer clicks a participant email', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );
    await user.click(screen.getByRole('menuitem', { name: /b@example\.com/ }));

    expect(
      screen.getByRole('heading', { name: 'Отправить приглашение?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Отправить' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
  });

  it('does not send the invitation when the user cancels the dialog', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );
    await user.click(screen.getByRole('menuitem', { name: /b@example\.com/ }));
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(meetingsMocks.sendMeetingInvitation).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: 'Отправить приглашение?' }),
    ).not.toBeInTheDocument();
  });

  it('sends the invitation on confirm and shows a success notification', async () => {
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );
    await user.click(screen.getByRole('menuitem', { name: /b@example\.com/ }));
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      expect(meetingsMocks.sendMeetingInvitation).toHaveBeenCalledWith(
        'token-1',
        'm1',
        'b@example.com',
      );
    });
    expect(
      await screen.findByText('Приглашение отправлено'),
    ).toBeInTheDocument();
  });

  it('only shows the list for a non-organizer and never offers to send', async () => {
    const user = userEvent.setup();
    renderDropdown({ isOrganizer: false });

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );

    const invitedItem = screen.getByRole('menuitem', {
      name: /b@example\.com/,
    });
    const ownItem = screen.getByRole('menuitem', {
      name: /user@example\.com/,
    });
    expect(invitedItem).toHaveAttribute('aria-disabled', 'true');
    expect(ownItem).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Это вы')).toBeInTheDocument();

    await user.click(invitedItem);
    expect(
      screen.queryByRole('heading', { name: 'Отправить приглашение?' }),
    ).not.toBeInTheDocument();
    expect(meetingsMocks.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('treats the organizer email as case-insensitive so casing cannot enable sending to it', async () => {
    const user = userEvent.setup();
    renderDropdown({ ownEmail: 'USER@example.com' });

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );

    const ownItem = screen.getByRole('menuitem', {
      name: /user@example\.com/,
    });
    expect(ownItem).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Это вы')).toBeInTheDocument();

    await user.click(ownItem);
    expect(
      screen.queryByRole('heading', { name: 'Отправить приглашение?' }),
    ).not.toBeInTheDocument();
    expect(meetingsMocks.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('shows an error notification and keeps the dialog open when sending fails', async () => {
    meetingsMocks.sendMeetingInvitation.mockRejectedValue(
      new ApiError(400, 'Email is not a participant of the meeting'),
    );
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );
    await user.click(screen.getByRole('menuitem', { name: /b@example\.com/ }));
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(
      await screen.findByText('Email is not a participant of the meeting'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Отправить приглашение?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Отправить' }),
    ).toBeInTheDocument();
  });

  it('redirects to login when sending returns 401', async () => {
    meetingsMocks.sendMeetingInvitation.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    const user = userEvent.setup();
    renderDropdown();

    await user.click(
      screen.getByRole('button', { name: 'Участники: 2 участников' }),
    );
    await user.click(screen.getByRole('menuitem', { name: /b@example\.com/ }));
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      expect(authMocks.clearAccessToken).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});
