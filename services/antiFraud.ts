import { supabase } from './supabase';

// Helper to generate a robust device hash based on browser properties and IP
export async function getDeviceHash(): Promise<string> {
  let localId = localStorage.getItem('nalabia_hwid');
  if (!localId) {
    localId = crypto.randomUUID();
    localStorage.setItem('nalabia_hwid', localId);
  }

  try {
    const ipRes = await Promise.race([
      fetch('https://api.ipify.org?format=json'),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (!ipRes) throw new Error('no response');
    const { ip } = await ipRes.json();
    const ua = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const raw = `${ip}-${ua}-${screen}`;
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn("Falling back to local ID for anti-fraud", e);
    return localId; // Fallback to local storage UUID if IP fetch fails or timeouts
  }
}

// Check if the device has used its 2 free messages
export async function checkDeviceUsage(): Promise<boolean> {
  const hash = await getDeviceHash();
  const localId = localStorage.getItem('nalabia_hwid');
  
  let totalUsage = 0;

  try {
    // Check hash-based usage (IP + Browser)
    const { data: hashData } = await supabase
      .from('device_usage')
      .select('count')
      .eq('id', hash)
      .single();
      
    if (hashData) {
      totalUsage = Math.max(totalUsage, hashData.count || 0);
    }

    // Check local storage ID usage (in case IP changed but cookies remain)
    if (localId) {
      const { data: localData } = await supabase
        .from('device_usage')
        .select('count')
        .eq('id', localId)
        .single();
        
      if (localData) {
        totalUsage = Math.max(totalUsage, localData.count || 0);
      }
    }
  } catch (e) {
    console.error("Error checking device usage:", e);
  }

  return totalUsage < 2;
}

// Increment the usage counter for this device
export async function incrementDeviceUsage(): Promise<void> {
  const hash = await getDeviceHash();
  const localId = localStorage.getItem('nalabia_hwid');

  try {
    // Upsert hash
    const { data: hashData } = await supabase
      .from('device_usage')
      .select('count')
      .eq('id', hash)
      .single();
      
    const currentHashCount = hashData?.count || 0;
    await supabase.from('device_usage').upsert({ id: hash, count: currentHashCount + 1, lastUsed: Date.now() });

    if (localId) {
      const { data: localData } = await supabase
        .from('device_usage')
        .select('count')
        .eq('id', localId)
        .single();
        
      const currentLocalCount = localData?.count || 0;
      await supabase.from('device_usage').upsert({ id: localId, count: currentLocalCount + 1, lastUsed: Date.now() });
    }
  } catch (e) {
    console.error("Error incrementing device usage:", e);
  }
}
