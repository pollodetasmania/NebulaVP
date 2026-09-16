import { useEffect, useState } from 'react';

// Navegación sencilla con "#". Ejemplos: #/catalogo, #/producto/abc, #/admin
// También acepta la dirección /admin (Vercel y Netlify la envían a la app).

export function readRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash !== '') {
    return hash;
  }
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/admin')) {
    return '/admin';
  }
  return '/';
}

export function goTo(route: string): void {
  window.location.hash = route;
}

export function useRoute(): string {
  const [route, setRoute] = useState(readRoute());

  useEffect(function () {
    function handleChange() {
      setRoute(readRoute());
    }
    window.addEventListener('hashchange', handleChange);
    return function () {
      window.removeEventListener('hashchange', handleChange);
    };
  }, []);

  return route;
}
