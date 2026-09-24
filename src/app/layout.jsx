import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AuthModal from '@/components/shared/AuthModal';
import PaymentModal from '@/components/shared/PaymentModal';

export const metadata = {
  metadataBase: new URL('https://kompetenzen.in'),
  title: "Kompetenzen — Career Consulting & Skill Development Academy, Kochi",
  description: "Kerala's #1 job-oriented skill development academy. Career consulting, full-stack training, corporate readiness and 2000+ placements.",
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: "Kompetenzen — Career Consulting & Training",
    description: "2000+ Placements, 1-on-1 Career Consulting, Tech School, B-School & Finishing School.",
    url: "https://kompetenzen.in",
    siteName: "Kompetenzen",
    images: [
      {
        url: "/bschool.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 72px)', paddingTop: '72px' }}>
            {children}
          </main>
          <Footer />
          <AuthModal />
          <PaymentModal />
        </AuthProvider>
      </body>
    </html>
  );
}
