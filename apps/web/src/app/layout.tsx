import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
import './globals.css';

const firaSans = Fira_Sans({
  variable: '--font-fira-sans',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
});

export const metadata: Metadata = {
  title: {
    default: 'MPixel',
    template: '%s | MPixel',
  },
  description: 'MPixel video meetings',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ru" className={firaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
