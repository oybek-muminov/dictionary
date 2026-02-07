import { APP_CONFIG, hasVapidKey } from "./config.js";

function base64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!isPushSupported()) {
    return "denied";
  }

  return Notification.requestPermission();
}

export async function registerServiceWorker() {
  if (!isPushSupported()) {
    throw new Error("Brauzer push notificationni qollamaydi.");
  }

  return navigator.serviceWorker.register("./sw.js");
}

export async function subscribeForPush({ accessToken, timezone }) {
  if (!hasVapidKey()) {
    throw new Error("VAPID_PUBLIC_KEY sozlanmagan.");
  }

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(APP_CONFIG.VAPID_PUBLIC_KEY)
    });
  }

  const json = subscription.toJSON();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: json.keys,
      timezone
    })
  });

  if (!response.ok) {
    let message = "Push obuna saqlanmadi.";

    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (_e) {
      // default message ishlatiladi
    }

    throw new Error(message);
  }

  return subscription;
}
