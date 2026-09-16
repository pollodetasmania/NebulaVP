import { useMemo, useState } from 'react';
import type { CatalogData, Product } from '../types';
import { BottomNav, LegalFooter, ProductPhoto, StatusBadge, Wordmark } from '../components/Common';
import type { NavItem } from '../components/Common';
import { Icon } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { formatMoney } from '../utils/format';
import { getStatus, priceLabel, sortPrices, sortProductsForDisplay, whatsappLink } from '../utils/products';

// ================= INICIO =================
function HomePage(props: { catalog: CatalogData; products: Product[] }) {
  const threshold = props.catalog.settings.lowStockThreshold;
  const featured = sortProductsForDisplay(props.products, threshold).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-ring" aria-hidden="true" />
        <h1 className="hero-title">
          <Wordmark size="hero" />
        </h1>
        <p className="hero-tagline">{props.catalog.settings.tagline}</p>
        <a className="btn btn-primary hero-cta" href="#/catalogo">
          Ver catálogo
        </a>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Catálogo</h2>
          <a className="text-link" href="#/catalogo">
            Ver todo
          </a>
        </div>
        {featured.length === 0 ? (
          <p className="empty-text">Pronto verás los productos aquí.</p>
        ) : (
          <div className="rail">
            {featured.map(function (product, index) {
              return (
                <div className="rail-item" key={product.id}>
                  <ProductCard product={product} lowStockThreshold={threshold} eager={index < 2} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

// ================= CATÁLOGO =================
function CatalogPage(props: { catalog: CatalogData; products: Product[] }) {
  const [categoryId, setCategoryId] = useState('todas');
  const [search, setSearch] = useState('');
  const threshold = props.catalog.settings.lowStockThreshold;

  // Solo se muestran categorías que tienen productos visibles.
  const usedCategories = props.catalog.categories.filter(function (category) {
    return props.products.some(function (product) {
      return product.categoryId === category.id;
    });
  });

  const shown = useMemo(
    function () {
      const text = search.trim().toLowerCase();
      const filtered = props.products.filter(function (product) {
        if (categoryId !== 'todas' && product.categoryId !== categoryId) {
          return false;
        }
        if (text !== '' && !product.name.toLowerCase().includes(text)) {
          return false;
        }
        return true;
      });
      return sortProductsForDisplay(filtered, threshold);
    },
    [props.products, categoryId, search, threshold],
  );

  return (
    <section className="section section-top">
      <header className="page-head">
        <Wordmark size="small" />
        <h1>Catálogo</h1>
      </header>

      <label className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          value={search}
          onChange={function (event) {
            setSearch(event.target.value);
          }}
        />
      </label>

      {usedCategories.length > 0 ? (
        <div className="chips" role="tablist" aria-label="Categorías">
          <button
            type="button"
            role="tab"
            aria-selected={categoryId === 'todas'}
            className={categoryId === 'todas' ? 'chip active' : 'chip'}
            onClick={function () {
              setCategoryId('todas');
            }}
          >
            Todo
          </button>
          {usedCategories.map(function (category) {
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={categoryId === category.id}
                className={categoryId === category.id ? 'chip active' : 'chip'}
                onClick={function () {
                  setCategoryId(category.id);
                }}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="empty-text">No encontramos productos con esa búsqueda.</p>
      ) : (
        <div className="product-grid">
          {shown.map(function (product, index) {
            return <ProductCard key={product.id} product={product} lowStockThreshold={threshold} eager={index < 4} />;
          })}
        </div>
      )}
    </section>
  );
}

// ================= DETALLE DEL PRODUCTO =================
function ProductPage(props: { catalog: CatalogData; product: Product | undefined }) {
  const product = props.product;
  const settings = props.catalog.settings;
  const prices = product ? sortPrices(product.prices) : [];
  const [selectedId, setSelectedId] = useState(prices.length > 0 ? prices[0].id : '');

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '/catalogo';
    }
  }

  if (!product) {
    return (
      <section className="section section-top">
        <button type="button" className="btn btn-ghost btn-small" onClick={goBack}>
          <Icon name="back" size={18} /> Volver
        </button>
        <p className="empty-text">Este producto ya no está disponible.</p>
      </section>
    );
  }

  const status = getStatus(product, settings.lowStockThreshold);
  const category = props.catalog.categories.find(function (item) {
    return item.id === product.categoryId;
  });
  const selected = prices.find(function (price) {
    return price.id === selectedId;
  });

  let message = 'Hola, quiero consultar por ' + product.name;
  if (selected) {
    message = message + ' (' + priceLabel(selected) + ', ' + formatMoney(selected.price) + ')';
  }
  message = message + '.';

  return (
    <article className="product-page">
      <div className="detail-photo">
        <ProductPhoto product={product} eager={true} />
        <button type="button" className="icon-button floating-back" onClick={goBack} aria-label="Volver">
          <Icon name="back" />
        </button>
      </div>

      <div className="detail-body">
        <div className="detail-meta">
          {category ? <span className="category-pill">{category.name}</span> : null}
          <StatusBadge status={status} />
        </div>
        <h1 className="detail-name">{product.name}</h1>
        {product.description ? <p className="detail-desc">{product.description}</p> : null}

        <h2 className="detail-subtitle">Precios</h2>
        {prices.length === 0 ? (
          <p className="empty-text">Precio por consultar.</p>
        ) : (
          <div className="price-list" role="radiogroup" aria-label="Opciones de precio">
            {prices.map(function (price) {
              const isSelected = price.id === selectedId;
              return (
                <button
                  key={price.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={isSelected ? 'price-option selected' : 'price-option'}
                  onClick={function () {
                    setSelectedId(price.id);
                  }}
                >
                  <span className="price-radio" aria-hidden="true" />
                  <span className="price-qty">{priceLabel(price)}</span>
                  <span className="price-value">{formatMoney(price.price)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="action-bar">
        {settings.whatsappNumber ? (
          <a
            className="btn btn-primary btn-block"
            href={whatsappLink(settings.whatsappNumber, message)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="chat" size={20} /> Consultar
          </a>
        ) : (
          <p className="action-note">El contacto por WhatsApp estará disponible pronto.</p>
        )}
      </div>
    </article>
  );
}

// ================= APP PÚBLICA =================
export function PublicApp(props: { route: string; catalog: CatalogData }) {
  const catalog = props.catalog;
  const visibleProducts = catalog.products.filter(function (product) {
    return product.visible;
  });

  const isProductPage = props.route.startsWith('/producto/');
  let page;
  if (isProductPage) {
    const productId = decodeURIComponent(props.route.slice('/producto/'.length));
    const product = visibleProducts.find(function (item) {
      return item.id === productId;
    });
    page = <ProductPage key={productId} catalog={catalog} product={product} />;
  } else if (props.route === '/catalogo') {
    page = <CatalogPage catalog={catalog} products={visibleProducts} />;
  } else {
    page = <HomePage catalog={catalog} products={visibleProducts} />;
  }

  const navItems: NavItem[] = [
    { label: 'Inicio', icon: 'home', href: '#/', active: props.route === '/' || props.route === '' },
    { label: 'Catálogo', icon: 'grid', href: '#/catalogo', active: props.route === '/catalogo' },
  ];
  if (catalog.settings.whatsappNumber) {
    navItems.push({
      label: 'Contacto',
      icon: 'chat',
      href: whatsappLink(catalog.settings.whatsappNumber, 'Hola, quiero hacer una consulta.'),
      active: false,
      external: true,
    });
  }

  return (
    <>
      <main className={isProductPage ? 'page page-detail' : 'page page-with-nav'}>
        {page}
        <LegalFooter text={catalog.settings.legalNotice} />
      </main>
      {isProductPage ? null : <BottomNav items={navItems} />}
    </>
  );
}
