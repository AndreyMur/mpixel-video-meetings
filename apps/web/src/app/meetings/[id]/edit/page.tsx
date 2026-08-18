import type { Metadata } from 'next';
import EditMeetingPage from './edit-meeting-page';

export const metadata: Metadata = {
  title: 'Изменить встречу',
  description: 'Редактирование встречи MPixel',
};

export default function EditMeetingRoute() {
  return <EditMeetingPage />;
}
