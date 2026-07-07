/**
 * Displays a desktop notification safely across different environments (including mobile PWA).
 * If the Service Worker is available, it uses the service worker registration.
 * Otherwise, it falls back to the legacy Notification constructor.
 *
 * @param {string} title
 * @param {NotificationOptions} options
 * @returns {Promise<boolean>} Resolves to true if notification was shown successfully, false otherwise.
 */
export async function showNotification(title, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Notifications not supported in this environment.");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted.");
    return false;
  }

  // Try using Service Worker registration first (required for mobile browsers like Chrome on Android/iOS PWA)
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === "function") {
        await registration.showNotification(title, {
          icon: "/favicon.ico",
          badge: "/icon-192.png",
          ...options
        });
        return true;
      }
    } catch (err) {
      console.warn("Service worker showNotification failed, trying legacy fallback:", err);
    }
  }

  // Fallback to legacy Notification constructor (works in standard desktop browsers)
  try {
    new Notification(title, {
      icon: "/favicon.ico",
      ...options
    });
    return true;
  } catch (err) {
    console.error("Legacy Notification constructor failed:", err);
    return false;
  }
}
