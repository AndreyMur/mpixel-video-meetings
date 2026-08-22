import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/auth';
import ConferencePage from './page';

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

const authMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getSessionUser: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getAccessToken: authMocks.getAccessToken,
    getSessionUser: authMocks.getSessionUser,
    clearAccessToken: authMocks.clearAccessToken,
  };
});

const conferenceMocks = vi.hoisted(() => ({
  getConferenceToken: vi.fn(),
}));

vi.mock('@/lib/conference', () => ({
  getConferenceToken: conferenceMocks.getConferenceToken,
}));

vi.mock('./conference-room', () => ({
  ConferenceRoom: ({ token }: { token: string }) => (
    <div data-testid="conference-room" data-token={token} />
  ),
}));

beforeEach(() => {
  replaceMock.mockClear();
  pushMock.mockClear();
  authMocks.getAccessToken.mockReset().mockReturnValue('access-token');
  authMocks.getSessionUser.mockReset().mockReturnValue({
    sub: 'u1',
    email: 'user@example.com',
  });
  authMocks.clearAccessToken.mockReset();
  conferenceMocks.getConferenceToken
    .mockReset()
    .mockResolvedValue({ token: 'lk-token' });
});

describe('ConferencePage', () => {
  it('redirects to /login when there is no session user', async () => {
    authMocks.getSessionUser.mockReset().mockReturnValue(null);

    render(<ConferencePage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(conferenceMocks.getConferenceToken).not.toHaveBeenCalled();
  });

  it('redirects to /login when the access token is missing', async () => {
    authMocks.getAccessToken.mockReset().mockReturnValue(null);

    render(<ConferencePage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(conferenceMocks.getConferenceToken).not.toHaveBeenCalled();
  });

  it('shows a loading state while fetching the token and then renders the room', async () => {
    let resolveToken!: (value: { token: string }) => void;
    conferenceMocks.getConferenceToken.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );

    render(<ConferencePage />);

    expect(screen.getByText('Подключение к конференции…')).toBeInTheDocument();

    resolveToken({ token: 'lk-token' });

    await waitFor(() =>
      expect(screen.getByTestId('conference-room')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('conference-room')).toHaveAttribute(
      'data-token',
      'lk-token',
    );
    expect(conferenceMocks.getConferenceToken).toHaveBeenCalledWith(
      'access-token',
      'm1',
    );
  });

  it('clears the access token and redirects to /login on 401', async () => {
    conferenceMocks.getConferenceToken
      .mockReset()
      .mockRejectedValue(new ApiError(401, 'Истек срок действия токена'));

    render(<ConferencePage />);

    await waitFor(() => expect(authMocks.clearAccessToken).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByTestId('conference-room')).not.toBeInTheDocument();
  });

  it('shows an unavailable state on 403 with a link back to the meeting', async () => {
    conferenceMocks.getConferenceToken
      .mockReset()
      .mockRejectedValue(new ApiError(403, 'Нет доступа'));

    render(<ConferencePage />);

    await waitFor(() =>
      expect(screen.getByText('Конференция недоступна')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText(/К встрече/));
    expect(pushMock).toHaveBeenCalledWith('/meetings/m1');
  });

  it('shows an unavailable state on 404', async () => {
    conferenceMocks.getConferenceToken
      .mockReset()
      .mockRejectedValue(new ApiError(404, 'Встреча не найдена'));

    render(<ConferencePage />);

    await waitFor(() =>
      expect(screen.getByText('Конференция недоступна')).toBeInTheDocument(),
    );
  });

  it('shows an error message and retries the request', async () => {
    conferenceMocks.getConferenceToken
      .mockReset()
      .mockRejectedValueOnce(new Error('Сеть недоступна'))
      .mockResolvedValueOnce({ token: 'lk-token-2' });

    render(<ConferencePage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Сеть недоступна');

    await userEvent.click(screen.getByText('Повторить'));

    await waitFor(() =>
      expect(screen.getByTestId('conference-room')).toHaveAttribute(
        'data-token',
        'lk-token-2',
      ),
    );
    expect(conferenceMocks.getConferenceToken).toHaveBeenCalledTimes(2);
  });
});
