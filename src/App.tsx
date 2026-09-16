import { useCallback, useEffect, useState } from 'react';
import type { CatalogData, DataStore } from './types';
import { AdminApp } from './admin/AdminApp';
import { AgeGate, readAgeConfirmation, saveAgeConfirmation } from './components/AgeGate';
import { SpaceBackground, Toast, Wordmark } from './components/Common';
import { createStore } from './data/store';
import { PublicApp } from './pages/PublicPages';
import { errorMessage } from './utils/format';
import { useRoute } from './utils/router';

export default function App() {
  const route = useRoute();
  const [store, setStore] = useState<DataStore | null>(null);
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [startError, setStartError] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(readAgeConfirmation());

  // Al abrir la app: elegir dónde están los datos y cargar el catálogo.
  useEffect(function () {
    let cancelled = false;
    async function start() {
      try {
        const createdStore = await createStore();
        const data = await createdStore.loadCatalog();
        if (!cancelled) {
          setStore(createdStore);
          setCatalog(data);
        }
      } catch (error) {
        if (!cancelled) {
          setStartError(errorMessage(error));
        }
      }
    }
    start();
    return function () {
      cancelled = true;
    };
  }, []);

  const reloadCatalog = useCallback(
    async function () {
      if (!store) {
        return;
      }
      const data = await store.loadCatalog();
      setCatalog(data);
    },
    [store],
  );

  // Cada vez que cambia la página, volver arriba.
  useEffect(
    function () {
      window.scrollTo(0, 0);
    },
    [route],
  );

  let content;
  if (!ageConfirmed) {
    content = (
      <AgeGate
        onConfirm={function () {
          saveAgeConfirmation();
          setAgeConfirmed(true);
        }}
      />
    );
  } else if (startError) {
    content = (
      <main className="gate">
        <Wordmark size="small" />
        <div className="gate-card">
          <h1>No se pudo abrir el catálogo</h1>
          <p>{startError}</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={function () {
              window.location.reload();
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </main>
    );
  } else if (!store || !catalog) {
    content = (
      <main className="gate">
        <Wordmark size="small" />
        <div className="loader" aria-label="Cargando" />
      </main>
    );
  } else if (route.startsWith('/admin')) {
    content = <AdminApp route={route} store={store} catalog={catalog} reloadCatalog={reloadCatalog} />;
  } else {
    content = <PublicApp route={route} catalog={catalog} />;
  }

  return (
    <>
      <SpaceBackground />
      <div className="app">{content}</div>
      <Toast />
    </>
  );
}
