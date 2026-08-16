import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Meeting } from '@/lib/auth';
import Home from '@/app/page';

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
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

const user = {
  email: 'user@example.com',
  name: 'Alice',
  avatarUrl: '/users/me/avatar',
};

const meeting: Meeting = {
  id: 'm1',
  title: 'Еженедельный синк',
  date: '2026-08-20T10:00:00.000Z',
  participants: ['u1', 'u2'],
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

class FakeImage {
  complete = true;
  naturalWidth = 100;
  naturalHeight = 100;
  src = '';
  crossOrigin: string | null = null;
  referrerPolicy = '';

  addEventListener() {}
  removeEventListener() {}
}

beforeEach(() => {
  replaceMock.mockClear();
  vi.stubGlobal('Image', FakeImage);
  authMocks.getAccessToken.mockReset().mockReturnValue('token-1');
  authMocks.getSessionUser.mockReset().mockReturnValue({
    sub: 'u1',
    email: 'user@example.com',
  });
  authMocks.getMeetings.mockReset().mockResolvedValue([]);
  authMocks.clearAccessToken.mockReset();
  profileMocks.getProfile.mockReset().mockResolvedValue(user);
  profileMocks.fetchAvatarSrc.mockReset().mockResolvedValue('blob:avatar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Home', () => {
  it('redirects to /login when there is no access token', async () => {
    authMocks.getAccessToken.mockReturnValue(null);
    render(<Home />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when there is no session user', async () => {
    authMocks.getSessionUser.mockReturnValue(null);
    render(<Home />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('fetches the profile from the API and shows the name and avatar in the header', async () => {
    render(<Home />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(
      await screen.findByAltText('Аватар пользователя'),
    ).toBeInTheDocument();
    expect(profileMocks.getProfile).toHaveBeenCalledWith('token-1');
    expect(profileMocks.fetchAvatarSrc).toHaveBeenCalledWith('token-1');
  });

  it('shows a placeholder avatar when the profile has no avatar', async () => {
    profileMocks.fetchAvatarSrc.mockResolvedValue(null);
    render(<Home />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(
      screen.queryByAltText('Аватар пользователя'),
    ).not.toBeInTheDocument();
  });

  it('falls back to the email when the profile has no name', async () => {
    profileMocks.getProfile.mockResolvedValue({
      email: 'user@example.com',
      name: null,
      avatarUrl: null,
    });
    render(<Home />);

    expect(await screen.findByText('user@example.com')).toBeInTheDocument();
  });

  it('renders a link from the header to the profile page', async () => {
    render(<Home />);

    await screen.findByText('Alice');

    expect(screen.getByRole('link', { name: /Профиль/ })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('includes the display name in the profile link accessible name', async () => {
    render(<Home />);

    expect(
      await screen.findByRole('link', { name: 'Профиль: Alice' }),
    ).toHaveAttribute('href', '/profile');
  });

  it('shows a profile error indicator when the profile fails to load', async () => {
    profileMocks.getProfile.mockRejectedValue(
      new ApiError(500, 'Ошибка сервера'),
    );
    render(<Home />);

    expect(
      await screen.findByLabelText(/Не удалось загрузить профиль/),
    ).toBeInTheDocument();
  });

  it('shows a placeholder avatar and no error when the avatar fetch fails', async () => {
    profileMocks.fetchAvatarSrc.mockRejectedValue(new Error('network'));
    render(<Home />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(
      screen.queryByAltText('Аватар пользователя'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the token and redirects when the profile fetch returns 401', async () => {
    profileMocks.getProfile.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    render(<Home />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
    expect(authMocks.clearAccessToken).toHaveBeenCalled();
  });

  it('renders meetings loaded from the API', async () => {
    authMocks.getMeetings.mockResolvedValue([meeting]);
    render(<Home />);

    const titles = await screen.findAllByText('Еженедельный синк');
    expect(titles.length).toBeGreaterThan(0);
    expect(authMocks.getMeetings).toHaveBeenCalledWith('token-1');
  });

  it('shows an error when meetings fail to load', async () => {
    authMocks.getMeetings.mockRejectedValue(
      new ApiError(500, 'Не удалось загрузить встречи'),
    );
    render(<Home />);

    expect(
      await screen.findByText(/Не удалось загрузить встречи/),
    ).toBeInTheDocument();
  });
});
