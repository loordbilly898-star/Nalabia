async function check() {
  try {
    const res = await fetch(
      "https://dxnxykpwmgbzsdiohgdo.supabase.co/auth/v1/health",
    );
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
check();
