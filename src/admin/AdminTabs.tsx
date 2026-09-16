import { useEffect, useState } from 'react';
import type { CatalogData, DataStore, Product, Sale, Settings } from '../types';
import { ConfirmDialog, ProductPhoto, StatusBadge, Stepper, showToast } from '../components/Common';
import { Icon } from '../components/Icon';
import { dayKey, dayTitle, errorMessage, formatMoney, formatTime, onlyDigits, unitsLabel } from '../utils/format';
import { getStatus, lowestQuantityPrice } from '../utils/products';
import { ProductEditor } from './ProductEditor';

// ======================= PRODUCTOS =======================
export function ProductsTab(props: { store: DataStore; catalog: CatalogData; reloadCatalog: () => Promise<void> }) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const threshold = props.catalog.settings.lowStockThreshold;
  const products = props.catalog.products.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name, 'es');
  });

  function categoryName(id: string | null): string {
    const category = props.catalog.categories.find(function (item) {
      return item.id === id;
    });
    return category ? category.name : 'Sin categoría';
  }

  return (
    <section className="section section-top">
      <div className="admin-title-row">
        <h1>Productos</h1>
        <span className="muted">{products.length} en total</span>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={function () {
          setEditing('new');
        }}
      >
        <Icon name="plus" size={20} /> Agregar producto
      </button>

      {products.length === 0 ? <p className="empty-text">Aún no hay productos. Agrega el primero.</p> : null}

      <ul className="admin-list">
        {products.map(function (product) {
          const firstPrice = lowestQuantityPrice(product);
          return (
            <li key={product.id}>
              <button
                type="button"
                className="admin-row"
                onClick={function () {
                  setEditing(product);
                }}
              >
                <div className="thumb">
                  <ProductPhoto product={product} />
                </div>
                <div className="admin-row-main">
                  <strong>
                    {product.name}
                    {product.isDemo ? <span className="tag-demo">Demo</span> : null}
                    {!product.visible ? <span className="tag-hidden">Oculto</span> : null}
                  </strong>
                  <span className="muted">
                    {categoryName(product.categoryId)}
                    {firstPrice ? ', desde ' + formatMoney(firstPrice.price) : ''}
                  </span>
                  <span className="admin-row-status">
                    <StatusBadge status={getStatus(product, threshold)} />
                    <span className="muted">Stock: {product.stock}</span>
                  </span>
                </div>
                <span className="admin-row-edit">Editar</span>
              </button>
            </li>
          );
        })}
      </ul>

      {editing !== null ? (
        <ProductEditor
          store={props.store}
          product={editing === 'new' ? null : editing}
          categories={props.catalog.categories}
          onClose={function () {
            setEditing(null);
          }}
          onSaved={props.reloadCatalog}
        />
      ) : null}
    </section>
  );
}

// ======================= INVENTARIO =======================
function InventoryRow(props: {
  product: Product;
  threshold: number;
  store: DataStore;
  reloadCatalog: () => Promise<void>;
}) {
  const [value, setValue] = useState(props.product.stock);
  const [saving, setSaving] = useState(false);
  const changed = value !== props.product.stock;

  // Si el stock cambia por una venta, se actualiza el número mostrado.
  useEffect(
    function () {
      setValue(props.product.stock);
    },
    [props.product.stock],
  );

  async function save() {
    setSaving(true);
    try {
      await props.store.setStock(props.product.id, value);
      showToast('Stock de ' + props.product.name + ' actualizado a ' + value);
      await props.reloadCatalog();
    } catch (saveError) {
      showToast(errorMessage(saveError), 'error');
    }
    setSaving(false);
  }

  return (
    <li className="inventory-row">
      <div className="inventory-info">
        <div className="thumb thumb-small">
          <ProductPhoto product={props.product} />
        </div>
        <div>
          <strong>{props.product.name}</strong>
          <StatusBadge status={getStatus(props.product, props.threshold)} />
        </div>
      </div>
      <div className="inventory-controls">
        <Stepper value={value} min={0} onChange={setValue} label={'Stock de ' + props.product.name} />
        {changed ? (
          <div className="inventory-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={function () {
                setValue(props.product.stock);
              }}
              disabled={saving}
            >
              Deshacer
            </button>
            <button type="button" className="btn btn-primary btn-small" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar ajuste'}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function InventoryTab(props: { store: DataStore; catalog: CatalogData; reloadCatalog: () => Promise<void> }) {
  const threshold = props.catalog.settings.lowStockThreshold;
  const products = props.catalog.products.slice().sort(function (a, b) {
    return a.stock - b.stock;
  });

  return (
    <section className="section section-top">
      <div className="admin-title-row">
        <h1>Inventario</h1>
      </div>
      <p className="muted">Usa - y + para corregir el stock y toca Guardar ajuste. Las ventas lo descuentan solas.</p>
      <ul className="admin-list">
        {products.map(function (product) {
          return (
            <InventoryRow
              key={product.id}
              product={product}
              threshold={threshold}
              store={props.store}
              reloadCatalog={props.reloadCatalog}
            />
          );
        })}
      </ul>
    </section>
  );
}

// ======================= VENTAS =======================
export function SalesTab(props: {
  store: DataStore;
  sales: Sale[] | null;
  salesError: string;
  reloadAll: () => Promise<void>;
}) {
  const [toCancel, setToCancel] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancelSale() {
    if (!toCancel) {
      return;
    }
    setBusy(true);
    try {
      await props.store.cancelSale(toCancel.id);
      showToast('Venta anulada. Las unidades volvieron al inventario.');
      await props.reloadAll();
    } catch (cancelError) {
      showToast(errorMessage(cancelError), 'error');
    }
    setBusy(false);
    setToCancel(null);
  }

  // Agrupar por día.
  const groups: { key: string; sales: Sale[] }[] = [];
  if (props.sales) {
    for (const sale of props.sales) {
      const key = dayKey(new Date(sale.createdAt));
      let group = groups.find(function (item) {
        return item.key === key;
      });
      if (!group) {
        group = { key: key, sales: [] };
        groups.push(group);
      }
      group.sales.push(sale);
    }
  }

  return (
    <section className="section section-top">
      <div className="admin-title-row">
        <h1>Ventas</h1>
      </div>

      {props.salesError ? <p className="form-error">{props.salesError}</p> : null}
      {props.sales === null && !props.salesError ? <p className="muted">Cargando ventas…</p> : null}
      {props.sales !== null && props.sales.length === 0 ? (
        <p className="empty-text">Todavía no hay ventas. Usa el botón Registrar venta.</p>
      ) : null}

      {groups.map(function (group) {
        return (
          <div className="sales-day" key={group.key}>
            <h2>{dayTitle(group.key)}</h2>
            <ul className="admin-list">
              {group.sales.map(function (sale) {
                const cancelled = sale.status === 'anulada';
                return (
                  <li key={sale.id} className={cancelled ? 'sale-row cancelled' : 'sale-row'}>
                    <div className="sale-main">
                      {sale.items.map(function (item, index) {
                        return (
                          <div key={index}>
                            <strong>{item.productName}</strong>
                            <span className="muted">{unitsLabel(item.quantity)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="sale-side">
                      <strong className="sale-amount">{formatMoney(sale.total)}</strong>
                      <span className="muted">{formatTime(sale.createdAt)}</span>
                      {cancelled ? (
                        <span className="tag-cancelled">Anulada</span>
                      ) : (
                        <button
                          type="button"
                          className="link-button"
                          onClick={function () {
                            setToCancel(sale);
                          }}
                        >
                          <Icon name="undo" size={16} /> Anular
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {toCancel ? (
        <ConfirmDialog
          title="¿Anular esta venta?"
          message={
            'Las unidades vuelven al inventario y la venta queda marcada como anulada. ' +
            toCancel.items
              .map(function (item) {
                return item.productName + ': ' + unitsLabel(item.quantity);
              })
              .join(', ') +
            '.'
          }
          confirmLabel="Anular venta"
          danger={true}
          busy={busy}
          onConfirm={cancelSale}
          onCancel={function () {
            setToCancel(null);
          }}
        />
      ) : null}
    </section>
  );
}

// ======================= AJUSTES =======================
export function SettingsTab(props: {
  store: DataStore;
  catalog: CatalogData;
  reloadCatalog: () => Promise<void>;
  onLogout: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(props.catalog.settings);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveSettings() {
    setSaving(true);
    try {
      await props.store.saveSettings({
        whatsappNumber: onlyDigits(settings.whatsappNumber),
        tagline: settings.tagline.trim(),
        lowStockThreshold: Math.max(0, settings.lowStockThreshold),
        legalNotice: settings.legalNotice.trim(),
      });
      showToast('Configuración guardada');
      await props.reloadCatalog();
    } catch (saveError) {
      showToast(errorMessage(saveError), 'error');
    }
    setSaving(false);
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (name === '') {
      return;
    }
    try {
      await props.store.saveCategory(name, null);
      setNewCategory('');
      showToast('Categoría creada');
      await props.reloadCatalog();
    } catch (categoryError) {
      showToast(errorMessage(categoryError), 'error');
    }
  }

  async function renameCategory() {
    if (!renaming || renaming.name.trim() === '') {
      return;
    }
    try {
      await props.store.saveCategory(renaming.name.trim(), renaming.id);
      setRenaming(null);
      showToast('Categoría actualizada');
      await props.reloadCatalog();
    } catch (categoryError) {
      showToast(errorMessage(categoryError), 'error');
    }
  }

  async function deleteCategory() {
    if (!toDelete) {
      return;
    }
    setBusy(true);
    try {
      await props.store.deleteCategory(toDelete.id);
      showToast('Categoría eliminada');
      await props.reloadCatalog();
    } catch (categoryError) {
      showToast(errorMessage(categoryError), 'error');
    }
    setBusy(false);
    setToDelete(null);
  }

  async function resetDemo() {
    setBusy(true);
    try {
      await props.store.resetDemo();
      showToast('Datos de demostración restablecidos');
      await props.reloadCatalog();
      window.location.reload();
    } catch (resetError) {
      showToast(errorMessage(resetError), 'error');
    }
    setBusy(false);
    setConfirmReset(false);
  }

  let modeText = 'Los datos se guardan solo en este navegador (modo demostración).';
  if (props.store.mode === 'claude') {
    modeText = 'Los datos se guardan en tu Artifact de Claude.';
  }
  if (props.store.mode === 'supabase') {
    modeText = 'Los datos se guardan en Supabase.';
  }

  return (
    <section className="section section-top">
      <div className="admin-title-row">
        <h1>Configuración</h1>
      </div>

      <div className="panel">
        <h2>Contacto y marca</h2>
        <label className="field">
          <span className="field-label">Número de WhatsApp</span>
          <input
            className="input"
            inputMode="tel"
            placeholder="Indicativo y número, sin espacios"
            value={settings.whatsappNumber}
            onChange={function (event) {
              setSettings({ ...settings, whatsappNumber: onlyDigits(event.target.value) });
            }}
          />
          <span className="field-help">Para Colombia empieza con 57. Déjalo vacío para ocultar el botón Consultar.</span>
        </label>
        <label className="field">
          <span className="field-label">Frase de la página de inicio</span>
          <input
            className="input"
            maxLength={60}
            value={settings.tagline}
            onChange={function (event) {
              setSettings({ ...settings, tagline: event.target.value });
            }}
          />
        </label>
        <div className="field">
          <span className="field-label">Avisar poco stock cuando queden</span>
          <Stepper
            value={settings.lowStockThreshold}
            min={0}
            max={999}
            label="Límite de poco stock"
            onChange={function (value) {
              setSettings({ ...settings, lowStockThreshold: value });
            }}
          />
        </div>
        <label className="field">
          <span className="field-label">Aviso legal (pie de página)</span>
          <textarea
            className="input textarea"
            rows={3}
            maxLength={300}
            value={settings.legalNotice}
            onChange={function (event) {
              setSettings({ ...settings, legalNotice: event.target.value });
            }}
          />
        </label>
        <button type="button" className="btn btn-primary btn-block" onClick={saveSettings} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>

      <div className="panel">
        <h2>Categorías</h2>
        <ul className="category-list">
          {props.catalog.categories.map(function (category) {
            const isRenaming = renaming !== null && renaming.id === category.id;
            return (
              <li key={category.id}>
                {isRenaming && renaming ? (
                  <div className="inline-row">
                    <input
                      className="input"
                      value={renaming.name}
                      aria-label="Nuevo nombre de la categoría"
                      onChange={function (event) {
                        setRenaming({ id: category.id, name: event.target.value });
                      }}
                    />
                    <button type="button" className="btn btn-primary btn-small" onClick={renameCategory}>
                      Guardar
                    </button>
                  </div>
                ) : (
                  <div className="category-item">
                    <span>{category.name}</span>
                    <div className="category-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={function () {
                          setRenaming({ id: category.id, name: category.name });
                        }}
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={'Eliminar ' + category.name}
                        onClick={function () {
                          setToDelete({ id: category.id, name: category.name });
                        }}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="inline-row">
          <input
            className="input"
            placeholder="Nueva categoría"
            value={newCategory}
            onChange={function (event) {
              setNewCategory(event.target.value);
            }}
          />
          <button type="button" className="btn btn-ghost btn-small" onClick={addCategory}>
            <Icon name="plus" size={18} /> Crear
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Sitio</h2>
        <p className="muted">{modeText}</p>
        <a className="btn btn-ghost btn-block" href="#/">
          <Icon name="eye" size={18} /> Ver catálogo como cliente
        </a>
        {props.store.mode === 'local' ? (
          <button
            type="button"
            className="btn btn-danger-ghost btn-block"
            onClick={function () {
              setConfirmReset(true);
            }}
          >
            Restablecer datos de demostración
          </button>
        ) : null}
        {props.store.mode === 'supabase' ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={props.onLogout}>
            <Icon name="logout" size={18} /> Cerrar sesión
          </button>
        ) : null}
      </div>

      {toDelete ? (
        <ConfirmDialog
          title="¿Eliminar categoría?"
          message={'Los productos de "' + toDelete.name + '" quedarán sin categoría. No se borra ningún producto.'}
          confirmLabel="Eliminar"
          danger={true}
          busy={busy}
          onConfirm={deleteCategory}
          onCancel={function () {
            setToDelete(null);
          }}
        />
      ) : null}

      {confirmReset ? (
        <ConfirmDialog
          title="¿Restablecer la demostración?"
          message="Se borran los productos, fotos y ventas de este navegador y vuelven los productos de ejemplo."
          confirmLabel="Restablecer"
          danger={true}
          busy={busy}
          onConfirm={resetDemo}
          onCancel={function () {
            setConfirmReset(false);
          }}
        />
      ) : null}
    </section>
  );
}
