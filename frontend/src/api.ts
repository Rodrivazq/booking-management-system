const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    // If response is not JSON (e.g. 413 Payload Too Large), use status text
    if (!res.ok) throw new Error(res.statusText || `Error ${res.status}`);
  }

  if (!res.ok) throw new Error((data as any).error || res.statusText || 'Error desconocido');
  return data as T;
}

export default apiFetch;
