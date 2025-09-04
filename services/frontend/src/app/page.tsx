import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/Landing/LandingPage';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';

export const metadata: Metadata = {
  title: 'KrishiMitra - Har Kisan Ka Digital Saathi',
  description: 'AI-powered Carbon Intelligence Platform for sustainable agriculture and carbon credit generation',
  keywords: 'agriculture, carbon credits, farming, sustainability, AI, IoT, blockchain',
  openGraph: {
    title: 'KrishiMitra - Every Farmer\'s Digital Companion',
    description: 'Empowering Indian farmers with AI-driven insights for sustainable agriculture and carbon credit generation',
    images: ['/og-image.png'],
  },
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
