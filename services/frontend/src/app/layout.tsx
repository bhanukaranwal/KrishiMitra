import './globals.css';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import { Providers } from './providers';
import { Header } from '@/components/Layout/Header';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Footer } from '@/components/Layout/Footer';
import { Toaster } from '@/components/UI/Toaster';
import { Analytics } from '@/components/Analytics';
import { PWAMetadata } from '@/components/PWA/PWAMetadata';
import { ServiceWorkerRegistration } from '@/components/PWA/ServiceWorkerRegistration';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({ 
  subsets: ['devanagari'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});

export const metadata = {
  title: 'KrishiMitra - Har Kisan Ka Digital Saathi',
  description: 'AI-powered Carbon Intelligence Platform for Agroforestry and Rice-Based Carbon Projects',
  keywords: 'agriculture, carbon credits, farming, AI, India, sustainability, climate change',
  authors: [{ name: 'KrishiMitra Team' }],
  creator: 'KrishiMitra',
  publisher: 'KrishiMitra',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://krishimitra.com',
    siteName: 'KrishiMitra',
    title: 'KrishiMitra - Har Kisan Ka Digital Saathi',
    description: 'AI-powered Carbon Intelligence Platform for Agroforestry and Rice-Based Carbon Projects',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KrishiMitra Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@krishimitra',
    creator: '@krishimitra',
    title: 'KrishiMitra - Har Kisan Ka Digital Saathi',
    description: 'AI-powered Carbon Intelligence Platform for Agroforestry and Rice-Based Carbon Projects',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansDevanagari.variable}`}>
      <head>
        <PWAMetadata />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="flex-1 p-4 md:p-6 lg:p-8">
                {children}
              </main>
              <Footer />
            </div>
          </div>
          <Toaster />
          <Analytics />
          <ServiceWorkerRegistration />
        </Providers>
      </body>
    </html>
  );
}
