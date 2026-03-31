export const sendNotification = async (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações.');
    return;
  }

  if (Notification.permission === 'granted') {
    // Try to use service worker if available
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        registration.showNotification(title, {
          icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg',
          badge: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg',
          vibrate: [200, 100, 200],
          ...options,
        } as any);
        return;
      }
    }
    
    // Fallback to standard Notification
    new Notification(title, {
      icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg',
      ...options,
    });
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};
