import type { Metadata } from 'next';
import LoginForm from './login-form';

export const metadata: Metadata = {
  title: 'Вход',
  description: 'Войдите в свой аккаунт MPixel',
};

export default function LoginPage() {
  return <LoginForm />;
}
