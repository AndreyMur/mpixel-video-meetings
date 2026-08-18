'use client';

import { TriangleExclamation, Video } from '@gravity-ui/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { ApiError, clearAccessToken, type Meeting } from '@/lib/auth';
import {
  createMeeting,
  fromDatetimeLocal,
  parseParticipants,
  toDatetimeLocal,
  updateMeeting,
  validateParticipants,
  type MeetingInput,
} from '@/lib/meetings';

interface MeetingFormProps {
  token: string;
  mode: 'create' | 'edit';
  meetingId?: string;
  initial?: Meeting;
  userEmail?: string;
}

export function MeetingForm({
  token,
  mode,
  meetingId,
  initial,
  userEmail,
}: MeetingFormProps) {
  const router = useRouter();
  const isEdit = mode === 'edit';
  const [isPending, setIsPending] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title')?.toString() ?? '';
    const description = formData.get('description')?.toString() ?? '';
    const date = formData.get('date')?.toString() ?? '';
    const participantsRaw = formData.get('participants')?.toString() ?? '';

    setIsPending(true);
    setFormError(null);
    setValidationErrors({});

    const participants = parseParticipants(participantsRaw);
    const input: MeetingInput = {
      title: title.trim(),
      date: fromDatetimeLocal(date),
      participants,
    };
    if (description.trim()) {
      input.description = description.trim();
    }

    try {
      const meeting = isEdit
        ? await updateMeeting(token, meetingId as string, input)
        : await createMeeting(token, input);
      router.push(`/meetings/${meeting.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError && error.details) {
        const details: Record<string, string> = {};
        for (const message of error.details) {
          const field = ['title', 'date', 'participants'].find((name) =>
            message.toLowerCase().includes(name),
          );
          details[field ?? 'title'] = message;
        }
        setValidationErrors(details);
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Something went wrong',
        );
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full" variant="secondary">
      <Card.Header>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Video aria-hidden="true" className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <Card.Title className="text-base">
            {isEdit ? 'Редактирование встречи' : 'Новая встреча'}
          </Card.Title>
          <Card.Description className="text-xs">
            Задайте название, время и участников встречи.
          </Card.Description>
        </div>
      </Card.Header>

      <Form
        className="flex flex-col gap-4 p-4"
        validationErrors={validationErrors}
        onSubmit={onSubmit}
      >
        <TextField
          isRequired
          name="title"
          defaultValue={initial?.title ?? ''}
          validate={(value) => {
            if (!value.trim()) {
              return 'Введите название встречи';
            }
            return null;
          }}
        >
          <Label>Название</Label>
          <Input placeholder="Еженедельный синк" />
          <FieldError />
        </TextField>

        <TextField name="description" defaultValue={initial?.description ?? ''}>
          <Label>Описание</Label>
          <TextArea
            rows={3}
            placeholder="О чём будет встреча (необязательно)"
          />
          <FieldError />
        </TextField>

        <TextField
          isRequired
          name="date"
          type="datetime-local"
          defaultValue={initial ? toDatetimeLocal(initial.date) : ''}
          validate={(value) => {
            if (!value) {
              return 'Укажите дату и время встречи';
            }
            return null;
          }}
        >
          <Label>Дата и время</Label>
          <Input />
          <FieldError />
        </TextField>

        <TextField
          name="participants"
          defaultValue={
            initial?.participants.filter((p) => p !== userEmail).join(', ') ??
            ''
          }
          validate={validateParticipants}
        >
          <Label>Участники</Label>
          <TextArea
            rows={3}
            placeholder="email@example.com, друг@example.com"
          />
          <FieldError />
        </TextField>

        {formError ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-danger"
          >
            <TriangleExclamation className="size-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" isPending={isPending}>
            {({ isPending: loading }) => (
              <>
                {loading ? (
                  <Spinner color="current" size="sm" aria-hidden="true" />
                ) : (
                  <Video className="size-4" />
                )}
                {loading
                  ? isEdit
                    ? 'Сохранение…'
                    : 'Создание…'
                  : isEdit
                    ? 'Сохранить'
                    : 'Создать встречу'}
              </>
            )}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
