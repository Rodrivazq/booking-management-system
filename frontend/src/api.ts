const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');

  const headers = new Headers(options.headers);

  // Solo setear Content-Type si hay body (POST/PUT/PATCH normalmente)
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Solo mandar Authorization si hay token
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Manejo de respuesta
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // si no es JSON, queda en null
  }

  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText || `Error ${res.status}`);
  }

  return data as T;
}

export default apiFetch;