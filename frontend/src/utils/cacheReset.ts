const APP_CACHE_VERSION = '2026-04-30-image-token-fix';

export async function checkAndResetCache() {
  const currentVersion = localStorage.getItem('app_cache_version');

  if (currentVersion !== APP_CACHE_VERSION) {
    console.warn('Nueva versión de caché detectada. Limpiando datos obsoletos...');

    // 1. Limpiar Session Storage completo
    sessionStorage.clear();

    // 2. Limpiar Local Storage (keys específicos para evitar borrar datos útiles que no tengan que ver, pero asegurando auth/token)
    // Usualmente la app guarda 'token' y 'auth-storage' (zustand persist)
    localStorage.removeItem('token');
    localStorage.removeItem('auth-storage');
    
    // Si hay otras keys como preferencias de usuario corruptas
    localStorage.removeItem('user-preferences');
    
    // Dejamos theme intacto si es posible, si no, lo limpiamos también.
    // localStorage.removeItem('theme');

    // 3. Registrar la nueva versión
    localStorage.setItem('app_cache_version', APP_CACHE_VERSION);

    // 4. Limpiar Service Worker caches (por si hay recursos estáticos en caché)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      } catch (err) {
        console.error('Error limpiando caches del Service Worker:', err);
      }
    }

    // 5. Desregistrar Service Workers existentes
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      } catch (err) {
        console.error('Error desregistrando Service Workers:', err);
      }
    }

    // 6. Recargar la página una única vez para aplicar el estado limpio
    window.location.reload();
  }
}
