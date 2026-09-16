import { useState } from 'react';
import type { CatalogData, DataStore } from '../types';
import { MoneyInput, ProductPhoto, Sheet, Stepper, showToast } from '../components/Common';
import { errorMessage, formatMoney, unitsLabel } from '../utils/format';
import { priceLabel, sortPrices, suggestedTotal } from '../utils/products';

// Formulario para registrar una venta: producto, cantidad, precio y confirmar.

interface Props {
  store: DataStore;
  catalog: CatalogData;
  onClose: () => void;
  onDone: () => Promise<void>;
}

export function SaleSheet(props: Props) {
  const products = props.catalog.products.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name, 'es');
  });

  const [productId, setProductId] = useState('');
  const [priceId, setPriceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [totalEdited, setTotalEdited] = useState(false);
  const [adultChecked, setAdultChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const product = products.find(function (item) {
    return item.id === productId;
  });
  const prices = product ? sortPrices(product.prices) : [];
  const selectedPrice = prices.find(function (price) {
    return price.id === priceId;
  });

  function chooseProduct(id: string) {
    setProductId(id);
    setError('');
    setTotalEdited(false);
    const chosen = products.find(function (item) {
      return item.id === id;
    });
    if (!chosen) {
      setPriceId('');
      setTotal(null);
      return;
    }
    const chosenPrices = sortPrices(chosen.prices);
    if (chosenPrices.length > 0) {
      setPriceId(chosenPrices[0].id);
      setQuantity(chosenPrices[0].quantity);
      setTotal(chosenPrices[0].price);
    } else {
      setPriceId('');
      setQuantity(1);
      setTotal(null);
    }
  }

  function choosePrice(id: string) {
    const price = prices.find(function (item) {
      return item.id === id;
    });
    if (!price) {
      return;
    }
    setPriceId(id);
    setQuantity(price.quantity);
    setTotal(price.price);
    setTotalEdited(false);
  }

  function changeQuantity(value: number) {
    setQuantity(value);
    // Si existe un precio exacto para esa cantidad, se selecciona solo.
    const exact = prices.find(function (price) {
      return price.quantity === value;
    });
    let priceToUse = selectedPrice;
    if (exact) {
      setPriceId(exact.id);
      priceToUse = exact;
    }
    if (priceToUse && !totalEdited) {
      setTotal(suggestedTotal(priceToUse, value));
    }
  }

  const stock = product ? product.stock : 0;
  const enoughStock = product ? quantity <= stock : false;
  const canConfirm =
    product !== undefined && quantity > 0 && enoughStock && total !== null && adultChecked && !saving;

  async function confirmSale() {
    if (!product || total === null) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const label = selectedPrice ? priceLabel(selectedPrice) + ' — ' + formatMoney(selectedPrice.price) : 'Precio manual';
      const newStock = await props.store.registerSale({
        productId: product.id,
        quantity: quantity,
        priceLabel: label,
        total: total,
      });
      showToast('Venta registrada. Stock de ' + product.name + ': ' + newStock);
      await props.onDone();
      props.onClose();
    } catch (saleError) {
      setError(errorMessage(saleError));
      setSaving(false);
    }
  }

  const footer = (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sale-total">
        <span>Total</span>
        <strong>{total === null ? '$0' : formatMoney(total)}</strong>
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={confirmSale} disabled={!canConfirm}>
        {saving ? 'Registrando…' : 'Confirmar venta'}
      </button>
    </>
  );

  return (
    <Sheet title="Registrar venta" onClose={props.onClose} footer={footer}>
      {/* PRODUCTO */}
      <label className="field">
        <span className="field-label">Producto</span>
        <select
          className="input"
          value={productId}
          onChange={function (event) {
            chooseProduct(event.target.value);
          }}
        >
          <option value="">Elige un producto</option>
          {products.map(function (item) {
            return (
              <option key={item.id} value={item.id} disabled={item.stock <= 0}>
                {item.name + (item.stock <= 0 ? ' (sin stock)' : ' (' + item.stock + ' disponibles)')}
              </option>
            );
          })}
        </select>
      </label>

      {product ? (
        <>
          <div className="sale-product">
            <div className="thumb">
              <ProductPhoto product={product} />
            </div>
            <div>
              <strong>{product.name}</strong>
              <span className={stock <= 0 ? 'muted danger-text' : 'muted'}>Stock actual: {stock}</span>
            </div>
          </div>

          {/* PRECIO */}
          <div className="field">
            <span className="field-label">Precio utilizado</span>
            {prices.length === 0 ? (
              <p className="field-help">Este producto no tiene precios. Escribe el total abajo.</p>
            ) : (
              <div className="price-list" role="radiogroup" aria-label="Precio utilizado">
                {prices.map(function (price) {
                  const isSelected = price.id === priceId;
                  return (
                    <button
                      key={price.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={isSelected ? 'price-option selected' : 'price-option'}
                      onClick={function () {
                        choosePrice(price.id);
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

          {/* CANTIDAD */}
          <div className="field">
            <span className="field-label">Cantidad</span>
            <Stepper value={quantity} min={1} max={Math.max(1, stock)} onChange={changeQuantity} label="Cantidad" />
            {!enoughStock ? <p className="form-error">Solo hay {unitsLabel(stock)} disponibles.</p> : null}
          </div>

          {/* TOTAL */}
          <div className="field">
            <label className="field-label" htmlFor="sale-total">
              Total cobrado
            </label>
            <MoneyInput
              id="sale-total"
              label="Total cobrado"
              value={total}
              onChange={function (value) {
                setTotal(value);
                setTotalEdited(true);
              }}
            />
            <p className="field-help">Se calcula solo. Cámbialo únicamente si cobraste otro valor.</p>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={adultChecked}
              onChange={function (event) {
                setAdultChecked(event.target.checked);
              }}
            />
            <span>Verifiqué que el comprador es mayor de 18 años.</span>
          </label>
        </>
      ) : null}
    </Sheet>
  );
}
