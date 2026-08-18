import type { Metadata } from 'next';
import NewMeetingPage from './new-meeting-page';

export const metadata: Metadata = {
  title: 'Создать встречу',
  description: 'Создание новой встречи MPixel',
};

export default function NewMeetingRoute() {
  return <NewMeetingPage />;
}
