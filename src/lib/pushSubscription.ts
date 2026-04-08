export const WEB_PUSH_PUBLIC_KEY = "BMSURaNYT8eRI-b-z742PQF-Hnqeb71f2f7Rk3_ttdSEEmLOTLKHd8jC_y8Fg_R7PviPuMF0es8gIkYxUVCiXQ8";

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function hasMatchingApplicationServerKey(subscription: PushSubscription, expectedKey: Uint8Array) {
  const currentKey = subscription.options?.applicationServerKey;

  if (!currentKey) {
    return true;
  }

  const currentKeyBytes = new Uint8Array(currentKey);

  if (currentKeyBytes.length !== expectedKey.length) {
    return false;
  }

  return currentKeyBytes.every((byte, index) => byte === expectedKey[index]);
}

export async function getValidPushSubscription(registration: ServiceWorkerRegistration) {
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return null;
  }

  const expectedKey = urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY);

  if (!hasMatchingApplicationServerKey(subscription, expectedKey)) {
    await subscription.unsubscribe();
    return null;
  }

  return subscription;
}

export async function ensureCurrentPushSubscription(registration: ServiceWorkerRegistration) {
  const expectedKey = urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !hasMatchingApplicationServerKey(subscription, expectedKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey,
    });
  }

  return subscription;
}
