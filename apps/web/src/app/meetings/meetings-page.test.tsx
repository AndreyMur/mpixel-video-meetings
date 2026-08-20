import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Meeting } from '@/lib/auth';
import MeetingsPage from '@/app/meetings/meetings-page';

const { replaceMock, routerMock } = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  return { replaceMock: replace, routerMock: { push, replace } };
});

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const authMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getSessionUser: vi.fn(),
  getMeetings: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAccessToken: authMocks.getAccessToken,
    getSessionUser: authMocks.getSessionUser,
    getMeetings: authMocks.getMeetings,
    clearAccessToken: authMocks.clearAccessToken,
  };
});

const meetingsMocks = vi.hoisted(() => ({
  deleteMeeting: vi.fn(),
}));

vi.mock('@/lib/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/meetings')>();
  return {
    ...actual,
    deleteMeeting: meetingsMocks.deleteMeeting,
  };
});

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  fetchAvatarSrc: vi.fn(),
}));

vi.mock('@/lib/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/profile')>();
  return {
    ...actual,
    getProfile: profileMocks.getProfile,
    fetchAvatarSrc: profileMocks.fetchAvatarSrc,
  };
});

const meeting: Meeting = {
  id: 'm1',
  title: 'Еженедельный синк',
  date: '2026-08-20T10:00:00.000Z',
  participants: ['a@example.com', 'b@example.com'],
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

beforeEach(() => {
  replaceMock.mockClear();
  authMocks.getAccessToken.mockReset().mockReturnValue('token-1');
  authMocks.getSessionUser.mockReset().mockReturnValue({
    sub: 'u1',
    email: 'user@example.com',
  });
  authMocks.getMeetings.mockReset().mockResolvedValue([meeting]);
  authMocks.clearAccessToken.mockReset();
  meetingsMocks.deleteMeeting.mockReset().mockResolvedValue(undefined);
  profileMocks.getProfile.mockReset().mockResolvedValue({
    email: 'user@example.com',
    name: null,
    avatarUrl: null,
  });
  profileMocks.fetchAvatarSrc.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MeetingsPage', () => {
  it('redirects to /login when there is no access token', async () => {
    authMocks.getAccessToken.mockReturnValue(null);
    render(<MeetingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when there is no session user', async () => {
    authMocks.getSessionUser.mockReturnValue(null);
    render(<MeetingsPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('renders the meetings loaded from the API', async () => {
    render(<MeetingsPage />);

    expect(await screen.findByText('Еженедельный синк')).toBeInTheDocument();
    expect(authMocks.getMeetings).toHaveBeenCalledWith('token-1');
  });

  it('shows the display name in the header when the profile has a name', async () => {
    profileMocks.getProfile.mockResolvedValue({
      email: 'user@example.com',
      name: 'Alice',
      avatarUrl: null,
    });
    render(<MeetingsPage />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(profileMocks.getProfile).toHaveBeenCalledWith('token-1');
  });

  it('falls back to the email in the header when the profile has no name', async () => {
    render(<MeetingsPage />);

    expect(await screen.findByText('user@example.com')).toBeInTheDocument();
  });

  it('links each meeting to its details page', async () => {
    render(<MeetingsPage />);

    expect(
      await screen.findByRole('link', { name: 'Открыть Еженедельный синк' }),
    ).toHaveAttribute('href', '/meetings/m1');
  });

  it('links to the create form', async () => {
    render(<MeetingsPage />);

    expect(
      await screen.findByRole('link', { name: /Создать встречу/ }),
    ).toHaveAttribute('href', '/meetings/new');
  });

  it('links to the edit form for each meeting', async () => {
    render(<MeetingsPage />);

    expect(
      await screen.findByRole('link', { name: 'Изменить Еженедельный синк' }),
    ).toHaveAttribute('href', '/meetings/m1/edit');
  });

  it('shows an error when meetings fail to load', async () => {
    authMocks.getMeetings.mockRejectedValue(
      new ApiError(500, 'Не удалось загрузить встречи'),
    );
    render(<MeetingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить встречи',
    );
  });

  it('deletes a meeting after confirming the dialog', async () => {
    const user = userEvent.setup();
    render(<MeetingsPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(meetingsMocks.deleteMeeting).toHaveBeenCalledWith('token-1', 'm1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Еженедельный синк')).not.toBeInTheDocument();
    });
  });

  it('shows the backend error when deleting a meeting with files', async () => {
    meetingsMocks.deleteMeeting.mockRejectedValue(
      new ApiError(
        409,
        'Cannot delete meeting with files; delete the files first',
      ),
    );
    const user = userEvent.setup();
    render(<MeetingsPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot delete meeting with files',
    );
    expect(screen.getByText('Еженедельный синк')).toBeInTheDocument();
  });

  it('keeps the meeting in the list when deletion fails', async () => {
    meetingsMocks.deleteMeeting.mockRejectedValue(
      new ApiError(500, 'Ошибка сервера'),
    );
    const user = userEvent.setup();
    render(<MeetingsPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ошибка сервера',
    );
    expect(screen.getByText('Еженедельный синк')).toBeInTheDocument();
  });

  it('redirects to login when deletion returns 401', async () => {
    meetingsMocks.deleteMeeting.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    const user = userEvent.setup();
    render(<MeetingsPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(authMocks.clearAccessToken).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});
