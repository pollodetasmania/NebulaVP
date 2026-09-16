import type { Product } from '../types';
import { formatMoney } from '../utils/format';
import { getStatus, lowestQuantityPrice, priceLabel } from '../utils/products';
import { ProductPhoto, StatusBadge } from './Common';

export function ProductCard(props: { product: Product; lowStockThreshold: number; eager?: boolean }) {
  const product = props.product;
  const status = getStatus(product, props.lowStockThreshold);
  const firstPrice = lowestQuantityPrice(product);
  const extraPrices = product.prices.length - 1;

  return (
    <a
      className={status === 'agotado' ? 'product-card is-sold-out' : 'product-card'}
      href={'#/producto/' + encodeURIComponent(product.id)}
    >
      <div className="card-photo">
        <ProductPhoto product={product} eager={props.eager} />
        <div className="card-status">
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="card-body">
        <h3 className="card-name">{product.name}</h3>
        {product.description ? <p className="card-desc">{product.description}</p> : null}
        <div className="card-price-row">
          {firstPrice ? (
            <>
              <span className="card-price">{formatMoney(firstPrice.price)}</span>
              <span className="card-price-note">
                {priceLabel(firstPrice)}
                {extraPrices > 0 ? ' · ' + (extraPrices + 1) + ' precios' : ''}
              </span>
            </>
          ) : (
            <span className="card-price-note">Precio por consultar</span>
          )}
        </div>
        <span className="btn btn-ghost btn-block btn-small card-cta">Ver producto</span>
      </div>
    </a>
  );
}
