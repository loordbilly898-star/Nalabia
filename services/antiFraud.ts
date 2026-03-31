import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

// Helper to generate a robust device hash based on browser properties and IP
export async function getDeviceHash(): Promise<string> {
  let localId = localStorage.getItem('nalabia_hwid');
  if (!localId) {
    localId = crypto.randomUUID();
    localStorage.setItem('nalabia_hwid', localId);
  }

  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipRes.json();
    const ua = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const raw = `${ip}-${ua}-${screen}`;
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return localId; // Fallback to local storage UUID if IP fetch fails
  }
}

// Check if the device has used its 2 free messages
export async function checkDeviceUsage(): Promise<boolean> {
  const hash = await getDeviceHash();
  const localId = localStorage.getItem('nalabia_hwid');
  
  let totalUsage = 0;

  try {
    // Check hash-based usage (IP + Browser)
    const hashRef = doc(db, 'device_usage', hash);
    const hashSnap = await getDoc(hashRef);
    if (hashSnap.exists()) {
      totalUsage = Math.max(totalUsage, hashSnap.data().count || 0);
    }

    // Check local storage ID usage (in case IP changed but cookies remain)
    if (localId) {
      const localRef = doc(db, 'device_usage', localId);
      const localSnap = await getDoc(localRef);
      if (localSnap.exists()) {
        totalUsage = Math.max(totalUsage, localSnap.data().count || 0);
      }
    }
  } catch (e) {
    console.error("Error checking device usage:", e);
    // If we can't check, we assume they can't use it to be safe, or we let it pass.
    // Let's let it pass if firestore fails, but usually it shouldn't.
  }

  return totalUsage < 2;
}

// Increment the usage counter for this device
export async function incrementDeviceUsage(): Promise<void> {
  const hash = await getDeviceHash();
  const localId = localStorage.getItem('nalabia_hwid');

  try {
    const hashRef = doc(db, 'device_usage', hash);
    await setDoc(hashRef, { count: increment(1), lastUsed: Date.now() }, { merge: true });

    if (localId) {
      const localRef = doc(db, 'device_usage', localId);
      await setDoc(localRef, { count: increment(1), lastUsed: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.error("Error incrementing device usage:", e);
  }
}
