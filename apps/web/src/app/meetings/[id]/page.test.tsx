import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Meeting } from '@/lib/auth';
import MeetingDetailPage from '@/app/meetings/[id]/page';

const { replaceMock, pushMock, routerMock } = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  return {
    replaceMock: replace,
    pushMock: push,
    routerMock: { push, replace },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => ({ id: 'm1' }),
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
  getMeeting: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAccessToken: authMocks.getAccessToken,
    getSessionUser: authMocks.getSessionUser,
    getMeeting: authMocks.getMeeting,
    clearAccessToken: authMocks.clearAccessToken,
  };
});

const filesMocks = vi.hoisted(() => ({
  getMeetingFiles: vi.fn(),
}));

vi.mock('@/lib/files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/files')>();
  return {
    ...actual,
    getMeetingFiles: filesMocks.getMeetingFiles,
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

vi.mock('@/components/file-upload-area', () => ({
  FileUploadArea: () => <div data-testid="file-upload-area" />,
}));

const meeting: Meeting = {
  id: 'm1',
  title: 'Еженедельный синк',
  date: '2026-08-20T10:00:00.000Z',
  participants: ['user@example.com', 'b@example.com'],
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

beforeEach(() => {
  replaceMock.mockClear();
  pushMock.mockClear();
  authMocks.getAccessToken.mockReset().mockReturnValue('token-1');
  authMocks.getSessionUser.mockReset().mockReturnValue({
    sub: 'u1',
    email: 'user@example.com',
  });
  authMocks.getMeeting.mockReset().mockResolvedValue(meeting);
  authMocks.clearAccessToken.mockReset();
  filesMocks.getMeetingFiles.mockReset().mockResolvedValue([]);
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

describe('MeetingDetailPage', () => {
  it('redirects to /login when there is no access token', async () => {
    authMocks.getAccessToken.mockReturnValue(null);
    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when there is no session user', async () => {
    authMocks.getSessionUser.mockReturnValue(null);
    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('renders the meeting details loaded from the API', async () => {
    render(<MeetingDetailPage />);

    expect(await screen.findByText('Еженедельный синк')).toBeInTheDocument();
    expect(authMocks.getMeeting).toHaveBeenCalledWith('m1', 'token-1');
  });

  it('shows the display name in the header when the profile has a name', async () => {
    profileMocks.getProfile.mockResolvedValue({
      email: 'user@example.com',
      name: 'Alice',
      avatarUrl: null,
    });
    render(<MeetingDetailPage />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(profileMocks.getProfile).toHaveBeenCalledWith('token-1');
  });

  it('falls back to the email in the header when the profile has no name', async () => {
    render(<MeetingDetailPage />);

    const header = await screen
      .findByText('MPixel Meeting')
      .then((node) => node.closest('header'));

    expect(header).not.toBeNull();
    expect(within(header!).getByText('user@example.com')).toBeInTheDocument();
  });

  it('links to the edit form', async () => {
    render(<MeetingDetailPage />);

    expect(
      await screen.findByRole('link', { name: 'Изменить Еженедельный синк' }),
    ).toHaveAttribute('href', '/meetings/m1/edit');
  });

  it('deletes a meeting after confirming the dialog and navigates to the list', async () => {
    const user = userEvent.setup();
    render(<MeetingDetailPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(meetingsMocks.deleteMeeting).toHaveBeenCalledWith('token-1', 'm1');
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/meetings');
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
    render(<MeetingDetailPage />);

    await screen.findByText('Еженедельный синк');

    await user.click(
      screen.getByRole('button', { name: 'Удалить Еженедельный синк' }),
    );
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot delete meeting with files',
    );
    expect(screen.getByText('Еженедельный синк')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('redirects to login when deletion returns 401', async () => {
    meetingsMocks.deleteMeeting.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    const user = userEvent.setup();
    render(<MeetingDetailPage />);

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
