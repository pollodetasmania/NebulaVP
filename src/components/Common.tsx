import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product, StockStatus } from '../types';
import { STATUS_LABEL } from '../utils/products';
import { Icon } from './Icon';
import type { IconName } from './Icon';

// ---------- Fondo espacial (solo CSS, muy liviano) ----------
export function SpaceBackground() {
  return (
    <div className="space" aria-hidden="true">
      <div className="nebula-cloud" />
      <div className="stars stars-far" />
      <div className="stars stars-near" />
    </div>
  );
}

// ---------- Logo ----------
export function Wordmark(props: { size: 'hero' | 'small' }) {
  return <span className={'wordmark wordmark-' + props.size}>NEBULA</span>;
}

// ---------- Estado del producto ----------
export function StatusBadge(props: { status: StockStatus }) {
  return (
    <span className={'status status-' + props.status}>
      <span className="status-dot" />
      {STATUS_LABEL[props.status]}
    </span>
  );
}

// ---------- Foto del producto (o marcador si aún no tiene) ----------
export function ProductPhoto(props: { product: Product; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = props.product.imageUrl;

  if (url && !failed) {
    return (
      <img
        className="photo-img"
        src={url}
        alt={props.product.name}
        loading={props.eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={function () {
          setFailed(true);
        }}
      />
    );
  }

  return (
    <div className="photo-empty">
      <svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true">
        <ellipse cx="40" cy="40" rx="34" ry="11" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" transform="rotate(-18 40 40)" />
        <circle cx="40" cy="40" r="9" fill="currentColor" opacity="0.8" />
      </svg>
      <span>Foto pendiente</span>
    </div>
  );
}

// ---------- Navegación inferior ----------
export interface NavItem {
  label: string;
  shortLabel?: string; // texto corto para teléfonos muy angostos
  icon: IconName;
  href: string;
  active: boolean;
  external?: boolean;
}

export function BottomNav(props: { items: NavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {props.items.map(function (item) {
        return (
          <a
            key={item.label}
            href={item.href}
            className={item.active ? 'nav-item active' : 'nav-item'}
            aria-current={item.active ? 'page' : undefined}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
          >
            <Icon name={item.icon} size={22} />
            {item.shortLabel ? (
              <>
                <span className="nav-label-long">{item.label}</span>
                <span className="nav-label-short">{item.shortLabel}</span>
              </>
            ) : (
              <span>{item.label}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

// ---------- Hoja que sube desde abajo (formularios) ----------
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(function () {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function () {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="sheet-backdrop" onClick={props.onClose} />
      <div className="sheet">
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
        {props.footer ? <div className="sheet-foot">{props.footer}</div> : null}
      </div>
    </div>
  );
}

// ---------- Ventana de confirmación ----------
export function ConfirmDialog(props: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-layer" role="alertdialog" aria-modal="true" aria-label={props.title}>
      <div className="sheet-backdrop" onClick={props.onCancel} />
      <div className="dialog">
        <h2>{props.title}</h2>
        <p>{props.message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={props.onCancel} disabled={props.busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={props.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={props.onConfirm}
            disabled={props.busy}
          >
            {props.busy ? 'Un momento…' : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Mensajes cortos (toast) ----------
export function showToast(message: string, kind?: 'ok' | 'error') {
  window.dispatchEvent(new CustomEvent('nebula-toast', { detail: { message: message, kind: kind || 'ok' } }));
}

export function Toast() {
  const [toast, setToast] = useState<{ message: string; kind: string; key: number } | null>(null);

  useEffect(function () {
    let timer = 0;
    function handleToast(event: Event) {
      const detail = (event as CustomEvent).detail;
      setToast({ message: detail.message, kind: detail.kind, key: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        setToast(null);
      }, 3200);
    }
    window.addEventListener('nebula-toast', handleToast);
    return function () {
      window.removeEventListener('nebula-toast', handleToast);
      window.clearTimeout(timer);
    };
  }, []);

  if (!toast) {
    return null;
  }
  return (
    <div key={toast.key} className={'toast toast-' + toast.kind} role="status" aria-live="polite">
      <Icon name={toast.kind === 'error' ? 'alert' : 'check'} size={20} />
      <span>{toast.message}</span>
    </div>
  );
}

// ---------- Campo de dinero con puntos de miles ----------
export function MoneyInput(props: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  id: string;
}) {
  let shown = '';
  if (props.value !== null) {
    shown = String(props.value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  return (
    <div className="money-input">
      <span aria-hidden="true">$</span>
      <input
        id={props.id}
        aria-label={props.label}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={shown}
        onChange={function (event) {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
          if (digits === '') {
            props.onChange(null);
          } else {
            props.onChange(Number(digits));
          }
        }}
      />
    </div>
  );
}

// ---------- Selector de cantidad con botones - y + ----------
export function Stepper(props: {
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const max = props.max === undefined ? 999999 : props.max;
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <button
        type="button"
        className="stepper-button"
        onClick={function () {
          props.onChange(Math.max(props.min, props.value - 1));
        }}
        disabled={props.value <= props.min}
        aria-label="Restar uno"
      >
        <Icon name="minus" />
      </button>
      <input
        className="stepper-value"
        inputMode="numeric"
        aria-label={props.label}
        value={String(props.value)}
        onChange={function (event) {
          const digits = event.target.value.replace(/\D/g, '');
          let number = digits === '' ? props.min : Number(digits);
          if (number > max) {
            number = max;
          }
          props.onChange(number);
        }}
      />
      <button
        type="button"
        className="stepper-button"
        onClick={function () {
          props.onChange(Math.min(max, props.value + 1));
        }}
        disabled={props.value >= max}
        aria-label="Sumar uno"
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

// ---------- Aviso legal al final de las páginas públicas ----------
export function LegalFooter(props: { text: string }) {
  return (
    <footer className="legal">
      <span className="legal-badge">18+</span>
      <p>{props.text}</p>
    </footer>
  );
}
