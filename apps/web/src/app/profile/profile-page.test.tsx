import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/auth';
import ProfilePage from '@/app/profile/profile-page';

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
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAccessToken: authMocks.getAccessToken,
    getSessionUser: authMocks.getSessionUser,
  };
});

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  fetchAvatarSrc: vi.fn(),
  updateName: vi.fn(),
  changePassword: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  validateAvatar: vi.fn(),
}));

vi.mock('@/lib/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/profile')>();
  return {
    ...actual,
    getProfile: profileMocks.getProfile,
    fetchAvatarSrc: profileMocks.fetchAvatarSrc,
    updateName: profileMocks.updateName,
    changePassword: profileMocks.changePassword,
    uploadAvatar: profileMocks.uploadAvatar,
    deleteAvatar: profileMocks.deleteAvatar,
    validateAvatar: profileMocks.validateAvatar,
  };
});

const user = {
  email: 'user@example.com',
  name: 'Alice',
  avatarUrl: '/users/me/avatar',
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
  profileMocks.getProfile.mockReset().mockResolvedValue(user);
  profileMocks.fetchAvatarSrc.mockReset().mockResolvedValue('blob:avatar');
  profileMocks.updateName
    .mockReset()
    .mockImplementation((_token, name) => Promise.resolve({ ...user, name }));
  profileMocks.changePassword.mockReset().mockResolvedValue(undefined);
  profileMocks.uploadAvatar.mockReset();
  profileMocks.deleteAvatar.mockReset().mockResolvedValue(undefined);
  profileMocks.validateAvatar.mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ProfilePage', () => {
  it('redirects to /login when there is no access token', async () => {
    authMocks.getAccessToken.mockReturnValue(null);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when there is no session user', async () => {
    authMocks.getSessionUser.mockReturnValue(null);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('renders email, name and avatar from the profile', async () => {
    render(<ProfilePage />);

    expect((await screen.findAllByText('Alice')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('user@example.com').length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByAltText('Аватар пользователя')).length,
    ).toBeGreaterThan(0);
    expect(profileMocks.getProfile).toHaveBeenCalledWith('token-1');
  });

  it('shows a placeholder avatar when the profile has no avatar', async () => {
    profileMocks.fetchAvatarSrc.mockResolvedValue(null);
    render(<ProfilePage />);

    expect(
      (await screen.findAllByText('user@example.com')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByAltText('Аватар пользователя'),
    ).not.toBeInTheDocument();
  });

  it('shows an error when the profile fails to load', async () => {
    profileMocks.getProfile.mockRejectedValue(
      new ApiError(500, 'Ошибка сервера'),
    );
    render(<ProfilePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ошибка сервера',
    );
  });

  it('clears the token and redirects when the profile fetch returns 401', async () => {
    profileMocks.getProfile.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    render(<ProfilePage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('updates the displayed name after saving without reloading', async () => {
    const userEventInstance = userEvent.setup();
    render(<ProfilePage />);

    await screen.findAllByText('Alice');

    const input = await screen.findByLabelText('Имя (display name)');
    await userEventInstance.clear(input);
    await userEventInstance.type(input, 'Мария');
    await userEventInstance.click(
      screen.getByRole('button', { name: 'Сохранить' }),
    );

    const header = screen.getByText('MPixel Meeting').closest('header');
    expect(header).not.toBeNull();
    expect(within(header!).getByText('Мария')).toBeInTheDocument();
    expect(profileMocks.updateName).toHaveBeenCalledWith('token-1', 'Мария');
  });

  it('shows the name validation error without submitting', async () => {
    const userEventInstance = userEvent.setup({ delay: null });
    render(<ProfilePage />);

    await screen.findAllByText('Alice');

    const input = await screen.findByLabelText('Имя (display name)');
    await userEventInstance.clear(input);
    await userEventInstance.type(input, 'a'.repeat(101));
    await userEventInstance.click(
      screen.getByRole('button', { name: 'Сохранить' }),
    );

    expect(
      await screen.findByText('Имя должно содержать не более 100 символов'),
    ).toBeInTheDocument();
    expect(profileMocks.updateName).not.toHaveBeenCalled();
  });

  it('shows a clear error when the old password is wrong', async () => {
    profileMocks.changePassword.mockRejectedValue(
      new ApiError(400, 'Неверный старый пароль'),
    );
    const userEventInstance = userEvent.setup();
    render(<ProfilePage />);

    await screen.findAllByText('Alice');

    await userEventInstance.type(
      screen.getByLabelText('Текущий пароль'),
      'old-password-1',
    );
    await userEventInstance.type(
      screen.getByLabelText('Новый пароль'),
      'new-password-1',
    );
    await userEventInstance.type(
      screen.getByLabelText('Повторите новый пароль'),
      'new-password-1',
    );
    await userEventInstance.click(
      screen.getByRole('button', { name: 'Сменить пароль' }),
    );

    expect(
      await screen.findByText('Неверный старый пароль'),
    ).toBeInTheDocument();
    expect(profileMocks.changePassword).toHaveBeenCalledWith(
      'token-1',
      'old-password-1',
      'new-password-1',
    );
  });

  it('shows the password confirmation validation error', async () => {
    const userEventInstance = userEvent.setup();
    render(<ProfilePage />);

    await screen.findAllByText('Alice');

    await userEventInstance.type(
      screen.getByLabelText('Текущий пароль'),
      'old-password-1',
    );
    await userEventInstance.type(
      screen.getByLabelText('Новый пароль'),
      'new-password-1',
    );
    await userEventInstance.type(
      screen.getByLabelText('Повторите новый пароль'),
      'different-password',
    );
    await userEventInstance.click(
      screen.getByRole('button', { name: 'Сменить пароль' }),
    );

    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument();
    expect(profileMocks.changePassword).not.toHaveBeenCalled();
  });

  it('uploads a new avatar and re-fetches it', async () => {
    profileMocks.uploadAvatar.mockResolvedValue({
      ...user,
      avatarUrl: '/users/me/avatar/new',
    });
    const userEventInstance = userEvent.setup();
    const { container } = render(<ProfilePage />);

    await screen.findAllByText('Alice');

    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await userEventInstance.upload(input as HTMLInputElement, file);

    await waitFor(() => {
      expect(profileMocks.uploadAvatar).toHaveBeenCalledWith(
        'token-1',
        file,
        expect.any(Function),
      );
    });
    expect(profileMocks.fetchAvatarSrc).toHaveBeenCalledWith('token-1');
  });

  it('shows the upload error when the avatar upload fails', async () => {
    profileMocks.uploadAvatar.mockRejectedValue(
      new ApiError(400, 'Неподдерживаемый формат изображения'),
    );
    const userEventInstance = userEvent.setup();
    const { container } = render(<ProfilePage />);

    await screen.findAllByText('Alice');

    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]');
    await userEventInstance.upload(input as HTMLInputElement, file);

    expect(
      await screen.findByText('Неподдерживаемый формат изображения'),
    ).toBeInTheDocument();
  });

  it('deletes the avatar after confirming the dialog', async () => {
    const userEventInstance = userEvent.setup();
    render(<ProfilePage />);

    await screen.findAllByAltText('Аватар пользователя');

    await userEventInstance.click(
      screen.getByRole('button', { name: 'Удалить' }),
    );

    const dialogConfirm = await screen.findByRole('button', {
      name: 'Удалить',
    });
    await userEventInstance.click(dialogConfirm);

    await waitFor(() => {
      expect(profileMocks.deleteAvatar).toHaveBeenCalledWith('token-1');
    });
  });

  it('keeps the page functional when the avatar fetch fails', async () => {
    profileMocks.fetchAvatarSrc.mockRejectedValue(new Error('network'));
    render(<ProfilePage />);

    expect((await screen.findAllByText('Alice')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByAltText('Аватар пользователя'),
    ).not.toBeInTheDocument();
  });
});
