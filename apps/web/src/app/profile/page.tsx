import type { Metadata } from 'next';
import ProfilePage from './profile-page';

export const metadata: Metadata = {
  title: 'Профиль',
  description: 'Управление профилем MPixel',
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
