'use client';

import {
  CircleCheck,
  PersonPencil,
  TriangleExclamation,
} from '@gravity-ui/icons';
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
  TextField,
} from '@heroui/react';
import { ApiError, clearAccessToken } from '@/lib/auth';
import { updateName, type UserProfile } from '@/lib/profile';

interface NameFormProps {
  token: string;
  name: string | null;
  onNameChanged: (profile: UserProfile) => void;
}

export function NameForm({ token, name, onNameChanged }: NameFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(name ?? '');
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextValue = value.trim();

    setIsPending(true);
    setFormError(null);
    setIsSaved(false);

    try {
      const profile = await updateName(token, nextValue);
      onNameChanged(profile);
      setIsSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full" variant="secondary">
      <Card.Header>
        <Card.Title>Имя</Card.Title>
        <Card.Description>
          Как вас видят другие участники встреч.
        </Card.Description>
      </Card.Header>

      <Form className="flex flex-col gap-4 p-4" onSubmit={onSubmit}>
        <TextField
          name="name"
          value={value}
          onChange={setValue}
          validate={(input) => {
            if (input.length > 100) {
              return 'Имя должно содержать не более 100 символов';
            }
            return null;
          }}
        >
          <Label>Имя (display name)</Label>
          <Input placeholder="Как к вам обращаться" autoComplete="nickname" />
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

        {isSaved ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-success"
          >
            <CircleCheck className="size-4 shrink-0" />
            Изменения сохранены
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" isPending={isPending}>
            {({ isPending: loading }) => (
              <>
                {loading ? (
                  <Spinner color="current" size="sm" aria-hidden="true" />
                ) : (
                  <PersonPencil className="size-4" />
                )}
                {loading ? 'Сохранение…' : 'Сохранить'}
              </>
            )}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
