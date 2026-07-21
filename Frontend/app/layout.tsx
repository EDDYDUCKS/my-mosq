import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from '@/lib/auth-context'
import { CartProvider } from '@/lib/cart-context'
import { NotificationsProvider } from '@/lib/notifications-context'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationsCenter } from '@/components/notifications-center'
import { MobileNav } from '@/components/mobile-nav'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MOSQ - Sistema de Gestión de Préstamos de Equipos Deportivos',
  description: 'Sistema de préstamos de equipos deportivos para Universidad Tecnológica La Salle',
  generator: 'ulsa.app',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/icon.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="gear-theme">
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
            <AuthProvider>
              <CartProvider>
                <NotificationsProvider>
                  <NotificationsCenter />
                  <div className="pb-16 md:pb-0">
                    {children}
                  </div>
                  <MobileNav />
                </NotificationsProvider>
              </CartProvider>
            </AuthProvider>
          </GoogleOAuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

