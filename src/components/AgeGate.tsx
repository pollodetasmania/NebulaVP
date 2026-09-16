import { useState } from 'react';
import { AGE_CONFIRMATION_HOURS } from '../config';
import { Wordmark } from './Common';

// Pantalla de confirmación de edad.
// Solo se guarda "sí confirmó" y la hora, ningún dato personal.

const AGE_KEY = 'nebula-age-confirmed-at';

export function readAgeConfirmation(): boolean {
  try {
    const saved = window.localStorage.getItem(AGE_KEY);
    if (!saved) {
      return false;
    }
    const hoursPassed = (Date.now() - Number(saved)) / 3600000;
    return hoursPassed < AGE_CONFIRMATION_HOURS;
  } catch (error) {
    return false;
  }
}

export function saveAgeConfirmation(): void {
  try {
    window.localStorage.setItem(AGE_KEY, String(Date.now()));
  } catch (error) {
    // Si no se puede guardar, se volverá a preguntar la próxima vez.
  }
}

export function AgeGate(props: { onConfirm: () => void }) {
  const [refused, setRefused] = useState(false);

  if (refused) {
    return (
      <main className="gate">
        <Wordmark size="small" />
        <div className="gate-card">
          <h1>Este catálogo es solo para mayores de edad</h1>
          <p>No puedes ver estos productos. La venta a menores de 18 años está prohibida por la ley.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gate">
      <Wordmark size="small" />
      <div className="gate-card">
        <span className="gate-badge">18+</span>
        <h1>¿Eres mayor de 18 años?</h1>
        <p>
          Este catálogo contiene productos de venta exclusiva para personas mayores de edad. Al continuar confirmas
          que tienes 18 años o más.
        </p>
        <div className="gate-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={props.onConfirm}>
            Sí, tengo 18 años o más
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={function () {
              setRefused(true);
            }}
          >
            No, soy menor de edad
          </button>
        </div>
      </div>
    </main>
  );
}
