/**
 * Helper seguro para requisições de API que previne o erro:
 * "Unexpected token 'A', 'A server e'... is not valid JSON"
 * quando a plataforma ou proxy retorna erro em HTML/Texto puro (ex: "A server error occurred").
 */

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    let parsed: any = null;
    if (rawText && rawText.trim().length > 0) {
      if (
        contentType.includes("application/json") ||
        rawText.trim().startsWith("{") ||
        rawText.trim().startsWith("[")
      ) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }
    }

    if (!res.ok) {
      const errMsg =
        parsed?.error ||
        parsed?.message ||
        (rawText && rawText.length < 200 ? rawText : `Erro no servidor (${res.status})`);
      return {
        ok: false,
        status: res.status,
        data: parsed,
        error: errMsg,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: parsed,
      error: undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || "Falha na conexão com o servidor.",
    };
  }
}
