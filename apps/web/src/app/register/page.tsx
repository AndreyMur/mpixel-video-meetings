import type { Metadata } from 'next';
import RegisterForm from './register-form';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт для встреч MPixel',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
