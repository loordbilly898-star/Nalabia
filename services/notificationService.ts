export const sendNotification = async (
  title: string,
  options?: NotificationOptions,
) => {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações.");
    return;
  }

  if (Notification.permission === "granted") {
    // Try to use service worker if available
    if ("serviceWorker" in navigator) {
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (registration) {
          registration.showNotification(title, {
            icon: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg",
            badge:
              "https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg",
            vibrate: [200, 100, 200],
            ...options,
          } as any);
          return;
        }
      } catch (e) {
        console.warn("Service worker notification failed", e);
      }
    }

    // Fallback to standard Notification
    new Notification(title, {
      icon: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Inf_sign.svg",
      ...options,
    });
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};
