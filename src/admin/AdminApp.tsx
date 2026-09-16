import { useCallback, useEffect, useState } from 'react';
import type { AdminAccess, CatalogData, DataStore, Sale } from '../types';
import { BottomNav, Wordmark, showToast } from '../components/Common';
import type { NavItem } from '../components/Common';
import { Icon } from '../components/Icon';
import { errorMessage } from '../utils/format';
import { InventoryTab, ProductsTab, SalesTab, SettingsTab } from './AdminTabs';
import { SaleSheet } from './SaleSheet';

// Panel de administración: /admin
// Pestañas: Productos, Inventario, Ventas, Configuración.

function LoginScreen(props: { store: DataStore; onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login() {
    setBusy(true);
    setError('');
    try {
      await props.store.login(email.trim(), password);
      props.onLoggedIn();
    } catch (loginError) {
      setError(errorMessage(loginError));
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <Wordmark size="small" />
      <div className="gate-card">
        <span className="gate-icon">
          <Icon name="lock" size={26} />
        </span>
        <h1>Administración</h1>
        <p>Ingresa con el correo y la contraseña del administrador.</p>
        <label className="field">
          <span className="field-label">Correo</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={function (event) {
              setEmail(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">Contraseña</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={function (event) {
              setPassword(event.target.value);
            }}
            onKeyDown={function (event) {
              if (event.key === 'Enter') {
                login();
              }
            }}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="button" className="btn btn-primary btn-block" onClick={login} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <a className="text-link" href="#/">
          Volver al catálogo
        </a>
      </div>
    </main>
  );
}

interface Props {
  route: string;
  store: DataStore;
  catalog: CatalogData;
  reloadCatalog: () => Promise<void>;
}

export function AdminApp(props: Props) {
  const [access, setAccess] = useState<AdminAccess | 'checking'>('checking');
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [salesError, setSalesError] = useState('');
  const [saleOpen, setSaleOpen] = useState(false);
  const store = props.store;

  const checkAccess = useCallback(
    async function () {
      try {
        setAccess(await store.getAdminAccess());
      } catch (accessError) {
        setAccess('denied');
      }
    },
    [store],
  );

  useEffect(
    function () {
      checkAccess();
    },
    [checkAccess],
  );

  const reloadSales = useCallback(
    async function () {
      try {
        const loaded = await store.loadSales();
        setSales(loaded);
        setSalesError('');
      } catch (loadError) {
        setSalesError('No se pudieron cargar las ventas: ' + errorMessage(loadError));
      }
    },
    [store],
  );

  const tab = props.route.replace(/^\/admin\/?/, '') || 'productos';

  // Las ventas se cargan al abrir la pestaña Ventas.
  useEffect(
    function () {
      if (access === 'allowed' && tab === 'ventas') {
        reloadSales();
      }
    },
    [access, tab, reloadSales],
  );

  async function reloadAll() {
    await props.reloadCatalog();
    if (tab === 'ventas') {
      await reloadSales();
    }
  }

  async function logout() {
    await store.logout();
    await props.reloadCatalog();
    showToast('Sesión cerrada');
    setAccess('login');
  }

  if (access === 'checking') {
    return (
      <main className="gate">
        <Wordmark size="small" />
        <p className="muted">Verificando acceso…</p>
      </main>
    );
  }

  if (access === 'login') {
    return (
      <LoginScreen
        store={store}
        onLoggedIn={async function () {
          await props.reloadCatalog();
          setAccess('allowed');
        }}
      />
    );
  }

  if (access === 'denied') {
    return (
      <main className="gate">
        <Wordmark size="small" />
        <div className="gate-card">
          <span className="gate-icon">
            <Icon name="lock" size={26} />
          </span>
          <h1>Sección privada</h1>
          <p>Solo el administrador de NEBULA puede entrar aquí.</p>
          <a className="btn btn-primary btn-block" href="#/">
            Ir al catálogo
          </a>
        </div>
      </main>
    );
  }

  let content;
  if (tab === 'inventario') {
    content = <InventoryTab store={store} catalog={props.catalog} reloadCatalog={props.reloadCatalog} />;
  } else if (tab === 'ventas') {
    content = <SalesTab store={store} sales={sales} salesError={salesError} reloadAll={reloadAll} />;
  } else if (tab === 'ajustes') {
    content = (
      <SettingsTab store={store} catalog={props.catalog} reloadCatalog={props.reloadCatalog} onLogout={logout} />
    );
  } else {
    content = <ProductsTab store={store} catalog={props.catalog} reloadCatalog={props.reloadCatalog} />;
  }

  const navItems: NavItem[] = [
    { label: 'Productos', icon: 'tag', href: '#/admin', active: tab === 'productos' },
    { label: 'Inventario', icon: 'box', href: '#/admin/inventario', active: tab === 'inventario' },
    { label: 'Ventas', icon: 'receipt', href: '#/admin/ventas', active: tab === 'ventas' },
    {
      label: 'Configuración',
      shortLabel: 'Ajustes',
      icon: 'sliders',
      href: '#/admin/ajustes',
      active: tab === 'ajustes',
    },
  ];

  return (
    <>
      <header className="admin-bar">
        <Wordmark size="small" />
        <span className="admin-pill">Administración</span>
        <a className="icon-button" href="#/" aria-label="Ver catálogo público">
          <Icon name="eye" />
        </a>
      </header>
      <main className="page page-with-nav page-admin">{content}</main>
      <button
        type="button"
        className="fab"
        onClick={function () {
          setSaleOpen(true);
        }}
      >
        <Icon name="plus" size={20} /> Registrar venta
      </button>
      <BottomNav items={navItems} />
      {saleOpen ? (
        <SaleSheet
          store={store}
          catalog={props.catalog}
          onClose={function () {
            setSaleOpen(false);
          }}
          onDone={reloadAll}
        />
      ) : null}
    </>
  );
}
