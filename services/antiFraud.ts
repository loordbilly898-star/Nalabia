import { supabase } from "./supabase";

export interface TrialStatus {
  isEligible: boolean;
  isActive: boolean;
  isExpired: boolean;
  trialStartedAt?: number;
  trialExpiresAt?: number;
  remainingMs: number;
  formattedRemaining: string;
  isAbuseBlocked?: boolean;
  message?: string;
}

// Generate persistent Hardware UUID with multi-storage fallback
export function getPersistentHwid(): string {
  let hwid = "";
  try {
    hwid = localStorage.getItem("nalabia_hwid") || "";
  } catch (e) {}

  if (!hwid) {
    try {
      hwid = sessionStorage.getItem("nalabia_hwid") || "";
    } catch (e) {}
  }

  if (!hwid) {
    try {
      // Check document.cookie
      const match = document.cookie.match(/(?:^|; )nalabia_hwid=([^;]*)/);
      if (match) hwid = decodeURIComponent(match[1]);
    } catch (e) {}
  }

  if (!hwid) {
    hwid = `hw_${crypto.randomUUID()}`;
    try {
      localStorage.setItem("nalabia_hwid", hwid);
      sessionStorage.setItem("nalabia_hwid", hwid);
      document.cookie = `nalabia_hwid=${encodeURIComponent(hwid)}; path=/; max-age=315360000; SameSite=Lax`;
    } catch (e) {}
  }

  return hwid;
}

// Helper to generate a robust device hash based on browser properties and IP
export async function getDeviceHash(): Promise<string> {
  const localId = getPersistentHwid();

  try {
    let ip = "";
    try {
      const ipRes = await Promise.race([
        fetch("https://api.ipify.org?format=json"),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 2000),
        ),
      ]);
      if (ipRes) {
        const data = await (ipRes as Response).json();
        ip = data.ip || "";
      }
    } catch (e) {}

    const ua = navigator.userAgent || "";
    const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 24}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = navigator.language || "";
    const raw = `${ip}-${ua}-${screen}-${tz}-${lang}-${localId}`;

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    console.warn("Falling back to local ID for anti-fraud", e);
    return localId;
  }
}

// Format milliseconds remaining into human readable Portuguese format
export function formatTrialRemainingTime(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

// Check or claim the 24-hour device trial
export async function verifyDeviceTrial(email?: string, userId?: string): Promise<TrialStatus> {
  const hwid = getPersistentHwid();
  const deviceHash = await getDeviceHash();

  try {
    const res = await fetch("/api/trial/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hwid,
        deviceHash,
        email: email || "",
        userId: userId || "",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        isEligible: Boolean(data.isEligible),
        isActive: Boolean(data.isActive),
        isExpired: Boolean(data.isExpired),
        trialStartedAt: data.trialStartedAt,
        trialExpiresAt: data.trialExpiresAt,
        remainingMs: data.remainingMs || 0,
        formattedRemaining: formatTrialRemainingTime(data.remainingMs || 0),
        isAbuseBlocked: Boolean(data.isAbuseBlocked),
        message: data.message,
      };
    }
  } catch (err) {
    console.warn("[AntiFraud] API verification failed, using local check:", err);
  }

  // Fallback to local storage timestamps if network is offline
  const localStart = parseInt(localStorage.getItem("nalabia_trial_start") || "0", 10);
  const localExpires = parseInt(localStorage.getItem("nalabia_trial_expires") || "0", 10);
  const now = Date.now();

  if (localExpires > 0) {
    const remaining = Math.max(0, localExpires - now);
    return {
      isEligible: false,
      isActive: remaining > 0,
      isExpired: remaining === 0,
      trialStartedAt: localStart,
      trialExpiresAt: localExpires,
      remainingMs: remaining,
      formattedRemaining: formatTrialRemainingTime(remaining),
      isAbuseBlocked: false,
    };
  }

  // Brand new device on fallback
  const start = now;
  const expires = now + 24 * 60 * 60 * 1000;
  localStorage.setItem("nalabia_trial_start", String(start));
  localStorage.setItem("nalabia_trial_expires", String(expires));

  return {
    isEligible: true,
    isActive: true,
    isExpired: false,
    trialStartedAt: start,
    trialExpiresAt: expires,
    remainingMs: 24 * 60 * 60 * 1000,
    formattedRemaining: "23h 59m 59s",
    isAbuseBlocked: false,
  };
}

// Check if device usage counter is valid
export async function checkDeviceUsage(): Promise<boolean> {
  const hash = await getDeviceHash();
  const localId = getPersistentHwid();

  let totalUsage = 0;

  try {
    const { data: hashData } = await supabase
      .from("device_usage")
      .select("count")
      .eq("id", hash)
      .single();

    if (hashData) {
      totalUsage = Math.max(totalUsage, hashData.count || 0);
    }

    if (localId) {
      const { data: localData } = await supabase
        .from("device_usage")
        .select("count")
        .eq("id", localId)
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
  const localId = getPersistentHwid();

  try {
    const { data: hashData } = await supabase
      .from("device_usage")
      .select("count")
      .eq("id", hash)
      .single();

    const currentHashCount = hashData?.count || 0;
    await supabase
      .from("device_usage")
      .upsert({ id: hash, count: currentHashCount + 1, lastUsed: Date.now() });

    if (localId) {
      const { data: localData } = await supabase
        .from("device_usage")
        .select("count")
        .eq("id", localId)
        .single();

      const currentLocalCount = localData?.count || 0;
      await supabase
        .from("device_usage")
        .upsert({
          id: localId,
          count: currentLocalCount + 1,
          lastUsed: Date.now(),
        });
    }
  } catch (e) {
    console.error("Error incrementing device usage:", e);
  }
}

