import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/auth';
import { MeetingForm } from '@/app/meetings/meeting-form';

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const meetingsMocks = vi.hoisted(() => ({
  createMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock('@/lib/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/meetings')>();
  return {
    ...actual,
    createMeeting: meetingsMocks.createMeeting,
    updateMeeting: meetingsMocks.updateMeeting,
  };
});

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    clearAccessToken: meetingsMocks.clearAccessToken,
  };
});

const createdMeeting = {
  id: 'm1',
  title: 'Синк',
  description: null,
  date: '2026-08-20T10:00:00.000Z',
  participants: [],
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  meetingsMocks.createMeeting.mockReset().mockResolvedValue(createdMeeting);
  meetingsMocks.updateMeeting.mockReset().mockResolvedValue(createdMeeting);
  meetingsMocks.clearAccessToken.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MeetingForm (create)', () => {
  it('renders the required fields and submit button', () => {
    render(<MeetingForm token="token-1" mode="create" />);

    expect(screen.getByLabelText('Название')).toBeInTheDocument();
    expect(screen.getByLabelText('Описание')).toBeInTheDocument();
    expect(screen.getByLabelText('Дата и время')).toBeInTheDocument();
    expect(screen.getByLabelText('Участники')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Создать встречу' }),
    ).toBeInTheDocument();
  });

  it('shows a validation error for an empty title', async () => {
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.clear(screen.getByLabelText('Название'));
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    expect(
      await screen.findByText('Введите название встречи'),
    ).toBeInTheDocument();
    expect(meetingsMocks.createMeeting).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid participant email', async () => {
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.type(screen.getByLabelText('Дата и время'), '2026-08-20T10:00');
    await user.type(screen.getByLabelText('Участники'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    expect(
      await screen.findByText('Некорректный email: not-an-email'),
    ).toBeInTheDocument();
    expect(meetingsMocks.createMeeting).not.toHaveBeenCalled();
  });

  it('shows a validation error for a missing date', async () => {
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    expect(
      await screen.findByText('Укажите дату и время встречи'),
    ).toBeInTheDocument();
    expect(meetingsMocks.createMeeting).not.toHaveBeenCalled();
  });

  it('creates a meeting via the proxy and navigates to its page', async () => {
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.type(screen.getByLabelText('Дата и время'), '2026-08-20T10:00');
    await user.type(
      screen.getByLabelText('Участники'),
      'a@example.com, b@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    await waitFor(() => {
      expect(meetingsMocks.createMeeting).toHaveBeenCalledWith(
        'token-1',
        expect.objectContaining({
          title: 'Синк',
          participants: ['a@example.com', 'b@example.com'],
        }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/meetings/m1');
    });
  });

  it('sends the description when filled', async () => {
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.type(screen.getByLabelText('Дата и время'), '2026-08-20T10:00');
    await user.type(screen.getByLabelText('Описание'), 'Обсудим планы');
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    await waitFor(() => {
      expect(meetingsMocks.createMeeting).toHaveBeenCalledWith(
        'token-1',
        expect.objectContaining({ description: 'Обсудим планы' }),
      );
    });
  });

  it('shows an API error when creation fails', async () => {
    meetingsMocks.createMeeting.mockRejectedValue(
      new ApiError(400, 'Некорректные данные'),
    );
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.type(screen.getByLabelText('Дата и время'), '2026-08-20T10:00');
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Некорректные данные',
    );
  });

  it('redirects to login on a 401 response', async () => {
    meetingsMocks.createMeeting.mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    const user = userEvent.setup();
    render(<MeetingForm token="token-1" mode="create" />);

    await user.type(screen.getByLabelText('Название'), 'Синк');
    await user.type(screen.getByLabelText('Дата и время'), '2026-08-20T10:00');
    await user.click(screen.getByRole('button', { name: 'Создать встречу' }));

    await waitFor(() => {
      expect(meetingsMocks.clearAccessToken).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});

describe('MeetingForm (edit)', () => {
  const meeting = {
    ...createdMeeting,
    title: 'Старый синк',
    description: 'Описание встречи',
    participants: ['a@example.com'],
  };

  it('prefills fields from the meeting data', () => {
    render(
      <MeetingForm
        token="token-1"
        mode="edit"
        meetingId="m1"
        initial={meeting}
      />,
    );

    expect(screen.getByLabelText('Название')).toHaveValue('Старый синк');
    expect(screen.getByLabelText('Описание')).toHaveValue('Описание встречи');
    expect(screen.getByLabelText('Участники')).toHaveValue('a@example.com');
  });

  it('updates the meeting via PATCH and navigates back', async () => {
    const user = userEvent.setup();
    render(
      <MeetingForm
        token="token-1"
        mode="edit"
        meetingId="m1"
        initial={meeting}
      />,
    );

    const title = screen.getByLabelText('Название');
    await user.clear(title);
    await user.type(title, 'Новый синк');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(meetingsMocks.updateMeeting).toHaveBeenCalledWith(
        'token-1',
        'm1',
        expect.objectContaining({
          title: 'Новый синк',
          description: 'Описание встречи',
          participants: ['a@example.com'],
        }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/meetings/m1');
    });
  });

  it('shows a validation error when the title is cleared', async () => {
    const user = userEvent.setup();
    render(
      <MeetingForm
        token="token-1"
        mode="edit"
        meetingId="m1"
        initial={meeting}
      />,
    );

    await user.clear(screen.getByLabelText('Название'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(
      await screen.findByText('Введите название встречи'),
    ).toBeInTheDocument();
    expect(meetingsMocks.updateMeeting).not.toHaveBeenCalled();
  });
});
