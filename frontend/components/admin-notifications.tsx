'use client';

import { useEffect, useRef } from 'react';
import { useNotifications } from '@/lib/notifications-context';
import { fetchAdminLoans } from '@/lib/api-client';

export function AdminNotifications() {
  const { addNotification } = useNotifications();
  const lastPendingCountRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    // Ask for native notification permissions
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkPendingLoans = async () => {
      try {
        const loansData = await fetchAdminLoans();
        if (!isMounted) return;

        const currentPending = loansData.filter(l => l.status === 'pending').length;
        
        if (currentPending > lastPendingCountRef.current) {
          // Play melodic sound
          try {
            const ctx = new AudioContext();
            const playNote = (freq: number, startTime: number, duration: number) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(freq, startTime);
              gain.gain.setValueAtTime(0, startTime);
              gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
              gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration - 0.05);
              osc.start(startTime);
              osc.stop(startTime + duration);
            };

            const t = ctx.currentTime;
            playNote(523.25, t, 0.15);       // C5
            playNote(659.25, t + 0.15, 0.15); // E5
            playNote(783.99, t + 0.30, 0.15); // G5
            playNote(1046.50, t + 0.45, 0.4); // C6
          } catch (e) {
            console.error('Audio play failed', e);
          }
          
          // OS Notification
          try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('¡Nueva Solicitud en MOSQ!', {
                body: 'Un estudiante acaba de solicitar un préstamo.',
                icon: '/icon.png',
              });
            }
          } catch (e) {
            console.error('Native notification failed', e);
          }

          // UI Alert
          addNotification('¡Nueva Solicitud!', 'Un estudiante acaba de solicitar un préstamo.', 'info');
        }
        
        lastPendingCountRef.current = currentPending;
      } catch (e) {
        // silent error for background polling
      }
    };

    // First check (to initialize count without alerting on refresh)
    const initCheck = async () => {
      try {
        const loansData = await fetchAdminLoans();
        if (!isMounted) return;
        lastPendingCountRef.current = loansData.filter(l => l.status === 'pending').length;
      } catch {
        // ignore
      }
    };

    initCheck();

    const intervalId = setInterval(checkPendingLoans, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [addNotification]);

  return null; // Invisible background component
}
