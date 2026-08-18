import type { Metadata } from 'next';
import MeetingsPage from './meetings-page';

export const metadata: Metadata = {
  title: 'Встречи',
  description: 'Список встреч MPixel',
};

export default function MeetingsRoute() {
  return <MeetingsPage />;
}
