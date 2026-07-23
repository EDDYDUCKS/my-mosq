'use client';

import React from 'react';
import { useNotifications } from '@/lib/notifications-context';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export function NotificationsCenter() {
  const { notifications, removeNotification, markAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${getBgColor(notification.type)} shadow-lg animate-in fade-in slide-in-from-top-2 duration-300`}
          onClick={() => markAsRead(notification.id)}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {notification.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
