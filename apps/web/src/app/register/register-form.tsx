'use client';

import { Eye, EyeClosed, Video } from '@gravity-ui/icons';
import Link from 'next/link';
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
import { ApiError, register } from '@/lib/auth';

export default function RegisterForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';

    setIsPending(true);
    setFormError(null);
    setValidationErrors({});

    try {
      const { accessToken } = await register(email, password);
      localStorage.setItem('accessToken', accessToken);
      router.push('/');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setValidationErrors({
          email: 'Пользователь с таким email уже зарегистрирован',
        });
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 via-background to-surface px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-secondary/20 blur-3xl"
      />

      <Card
        variant="tertiary"
        className="relative z-10 w-full max-w-md border-accent/15 p-6 shadow-2xl shadow-accent/10 sm:p-8"
      >
        <Card.Header className="items-center gap-2 text-center">
          <Video className="size-10 text-accent" />
          <Card.Title
            className="text-2xl font-semibold tracking-tight"
            render={(props) => <h1 {...props} />}
          >
            MPixel Meeting
          </Card.Title>
          <Card.Description>
            Присоединяйтесь к встречам MPixel за считанные секунды. Укажите
            email и пароль.
          </Card.Description>
          <h3 className="text-lg font-semibold tracking-tight">Регистрация</h3>
        </Card.Header>

        <Form
          className="flex flex-col gap-4"
          validationErrors={validationErrors}
          onSubmit={onSubmit}
        >
          <Card.Content className="flex flex-col gap-4">
            <TextField
              isRequired
              name="email"
              type="email"
              validate={(value) => {
                if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
                  return 'Введите корректный email';
                }
                return null;
              }}
            >
              <Label>Email</Label>
              <Input placeholder="you@example.com" autoComplete="email" />
              <FieldError />
            </TextField>

            <TextField
              isRequired
              name="password"
              type={isPasswordVisible ? 'text' : 'password'}
              minLength={8}
              onChange={setPassword}
              validate={(value) => {
                if (value.length < 8) {
                  return 'Пароль должен содержать минимум 8 символов';
                }
                return null;
              }}
            >
              <Label>Пароль</Label>
              <div className="relative">
                <Input
                  fullWidth
                  className="pe-10"
                  placeholder="Не менее 8 символов"
                  autoComplete="new-password"
                />
                <Button
                  aria-label={
                    isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'
                  }
                  className="absolute end-1 top-1/2 h-8 min-h-8 w-8 -translate-y-1/2 bg-transparent p-0 text-muted shadow-none hover:text-foreground"
                  isIconOnly
                  variant="ghost"
                  onPress={() => setIsPasswordVisible((v) => !v)}
                >
                  {isPasswordVisible ? (
                    <EyeClosed className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              <FieldError />
            </TextField>

            <TextField
              isRequired
              name="confirmPassword"
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              autoComplete="new-password"
              validate={(value) => {
                if (value.length < 8) {
                  return 'Пароль должен содержать минимум 8 символов';
                }
                if (value !== password) {
                  return 'Пароли не совпадают';
                }
                return null;
              }}
            >
              <Label>Повторите пароль</Label>
              <div className="relative">
                <Input
                  fullWidth
                  className="pe-10"
                  placeholder="Повторите пароль"
                />
                <Button
                  aria-label={
                    isConfirmPasswordVisible
                      ? 'Скрыть пароль'
                      : 'Показать пароль'
                  }
                  className="absolute end-1 top-1/2 h-8 min-h-8 w-8 -translate-y-1/2 bg-transparent p-0 text-muted shadow-none hover:text-foreground"
                  isIconOnly
                  variant="ghost"
                  onPress={() => setIsConfirmPasswordVisible((v) => !v)}
                >
                  {isConfirmPasswordVisible ? (
                    <EyeClosed className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              <FieldError />
            </TextField>

            {formError ? (
              <p className="text-sm text-danger">{formError}</p>
            ) : null}
          </Card.Content>

          <Card.Footer className="flex-col gap-3">
            <Button className="w-full" type="submit" isPending={isPending}>
              {({ isPending: loading }) => (
                <>
                  {loading ? <Spinner color="current" size="sm" /> : null}
                  {loading ? 'Создание аккаунта…' : 'Создайте аккаунт'}
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted">
              Есть аккаунт?{' '}
              <Link
                className="font-medium text-foreground hover:text-accent"
                href="/login"
              >
                Войдите
              </Link>
            </p>
          </Card.Footer>
        </Form>
      </Card>
    </main>
  );
}
