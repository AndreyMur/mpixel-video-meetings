'use client';

import {
  CircleCheck,
  Eye,
  EyeClosed,
  Key,
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
import { changePassword } from '@/lib/profile';

function PasswordInput({
  label,
  autoComplete,
  isVisible,
  onToggle,
  value,
  onChange,
  name,
  isRequired,
  validate,
}: {
  label: string;
  autoComplete: string;
  isVisible: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  isRequired?: boolean;
  validate?: (value: string) => string | null;
}) {
  return (
    <TextField
      name={name}
      type={isVisible ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      validate={validate}
    >
      <Label>{label}</Label>
      <div className="relative">
        <Input fullWidth className="pe-10" />
        <Button
          aria-label={
            isVisible
              ? `Скрыть ${label.toLowerCase()}`
              : `Показать ${label.toLowerCase()}`
          }
          className="absolute end-1 top-1/2 h-8 min-h-8 w-8 -translate-y-1/2 bg-transparent p-0 text-muted shadow-none hover:text-foreground"
          isIconOnly
          variant="ghost"
          onPress={onToggle}
        >
          {isVisible ? (
            <EyeClosed className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </div>
      <FieldError />
    </TextField>
  );
}

export function PasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isOldVisible, setIsOldVisible] = useState(false);
  const [isNewVisible, setIsNewVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsPending(true);
    setFormError(null);
    setIsSaved(false);

    try {
      await changePassword(token, oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
        <Card.Title>Безопасность</Card.Title>
        <Card.Description>
          Пароль используется для входа в ваш аккаунт.
        </Card.Description>
      </Card.Header>

      <Form className="flex flex-col gap-4 p-4" onSubmit={onSubmit}>
        <PasswordInput
          label="Текущий пароль"
          autoComplete="current-password"
          isVisible={isOldVisible}
          onToggle={() => setIsOldVisible((v) => !v)}
          value={oldPassword}
          onChange={setOldPassword}
        />

        <PasswordInput
          label="Новый пароль"
          autoComplete="new-password"
          isVisible={isNewVisible}
          onToggle={() => setIsNewVisible((v) => !v)}
          value={newPassword}
          onChange={setNewPassword}
          isRequired
          validate={(input) => {
            if (input.length < 8) {
              return 'Пароль должен содержать минимум 8 символов';
            }
            return null;
          }}
        />

        <TextField
          name="confirmPassword"
          type={isConfirmVisible ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={setConfirmPassword}
          validate={(value) => {
            if (value.length < 8) {
              return 'Пароль должен содержать минимум 8 символов';
            }
            if (value !== newPassword) {
              return 'Пароли не совпадают';
            }
            return null;
          }}
        >
          <Label>Повторите новый пароль</Label>
          <div className="relative">
            <Input fullWidth className="pe-10" />
            <Button
              aria-label={
                isConfirmVisible
                  ? 'Скрыть повтор пароля'
                  : 'Показать повтор пароля'
              }
              className="absolute end-1 top-1/2 h-8 min-h-8 w-8 -translate-y-1/2 bg-transparent p-0 text-muted shadow-none hover:text-foreground"
              isIconOnly
              variant="ghost"
              onPress={() => setIsConfirmVisible((v) => !v)}
            >
              {isConfirmVisible ? (
                <EyeClosed className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
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
            Пароль изменён
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" isPending={isPending}>
            {({ isPending: loading }) => (
              <>
                {loading ? (
                  <Spinner color="current" size="sm" aria-hidden="true" />
                ) : (
                  <Key className="size-4" />
                )}
                {loading ? 'Смена пароля…' : 'Сменить пароль'}
              </>
            )}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
