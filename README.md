# NEBULA — Catálogo y panel de ventas

Aplicación web para celular con:

- Catálogo público con precios por cantidad.
- Botón "Consultar" por WhatsApp.
- Pantalla de mayoría de edad (18+).
- Panel privado `/admin` para productos, fotos, inventario, ventas y configuración.

Los productos que trae (Nebula X, Pro, Air, Max y Cable USB-C) son **de demostración**. Tienen la etiqueta "Demo" y se pueden borrar desde el panel.

---

## 1. Probar en tu computador

Necesitas Node.js 20 o más reciente.

```bash
npm install
npm run dev
```

Abre la dirección que aparece en la terminal, por ejemplo `http://localhost:5173`.

- El panel está en `http://localhost:5173/#/admin`.
- Si no configuras Supabase, los datos se guardan solo en ese navegador (modo demostración).
- Para ver la app en tu celular, conéctalo a la misma red wifi y abre la dirección que dice "Network".

---

## 2. Publicarla gratis con un enlace público (Supabase + Vercel)

### Paso A: base de datos (Supabase)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
2. Entra a **SQL Editor**, pega todo el archivo `supabase/schema.sql` y presiona **Run**.
3. (Opcional) Para cargar los productos de demostración, pega y ejecuta `supabase/seed.sql`.
4. Entra a **Authentication > Users > Add user** y crea el usuario administrador con tu correo y una contraseña.
5. Entra a **Authentication > Sign In / Providers** y desactiva **Allow new users to sign up**. Así nadie más puede crear cuentas.
6. Entra a **Project Settings > API** y copia la **Project URL** y la **anon public key**.

### Paso B: sitio web (Vercel)

1. Sube esta carpeta a un repositorio de GitHub. El archivo `.env` no se sube.
2. En https://vercel.com elige **Add New > Project** e importa el repositorio.
3. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la anon public key
   - `VITE_WHATSAPP_NUMBER` = tu número con indicativo, solo dígitos. Ejemplo para Colombia: 57 seguido del número.
4. Presiona **Deploy**.

Vercel te entrega un enlace como `https://nebula-xxxx.vercel.app`:

- **Catálogo:** ese enlace. Es el que compartes con los clientes.
- **Panel:** el mismo enlace terminado en `/admin`. Pide el correo y la contraseña del paso A.

Netlify también funciona: comando de build `npm run build`, carpeta `dist`. El archivo `public/_redirects` ya está incluido.

---

## 3. Modificar productos

1. Entra a `/admin`, pestaña **Productos**.
2. Toca un producto, o **Agregar producto**.
3. Cambia lo que necesites:
   - **Foto:** Subir fotografía / Cambiar foto / Quitar foto. Se reduce sola para que cargue rápido.
   - Nombre, descripción y categoría. Con el botón **+** creas una categoría nueva.
   - Stock.
   - **Precios:** escribe la cantidad y el precio total. Usa **Agregar otro precio** para más opciones.
   - Disponibilidad y si se muestra o no en el catálogo.
4. Toca **Guardar producto**.

- El stock rápido se corrige en la pestaña **Inventario**.
- El número de WhatsApp, la frase de inicio y las categorías se cambian en **Configuración**.

---

## 4. Registrar una venta

1. En `/admin` toca **+ Registrar venta**.
2. Elige el producto y el precio. La cantidad se ajusta sola, pero puedes cambiarla con − y +.
3. Revisa el total. Solo cámbialo si cobraste otro valor.
4. Marca **Verifiqué que el comprador es mayor de 18 años**.
5. Toca **Confirmar venta**. El stock baja automáticamente.

En la pestaña **Ventas** están las ventas agrupadas por día.

- **Anular** devuelve las unidades al inventario.
- La venta anulada queda marcada como anulada en el historial.

---

## Estructura de archivos

| Carpeta o archivo | Para qué sirve |
| --- | --- |
| `src/pages/PublicPages.tsx` | Inicio, catálogo y detalle del producto |
| `src/admin/` | Panel: productos, inventario, ventas, configuración |
| `src/components/` | Piezas reutilizables (tarjetas, botones, íconos, 18+) |
| `src/data/localStore.ts` | Datos en el navegador (demostración) |
| `src/data/supabaseStore.ts` | Datos en Supabase (sitio publicado) |
| `src/data/claudeStore.ts` | Datos cuando la app se publica como Artifact de Claude |
| `src/data/demoData.ts` | Productos de demostración |
| `src/styles.css` | Todo el diseño |
| `supabase/schema.sql` | Tablas, seguridad y funciones de Supabase |
| `supabase/seed.sql` | Datos de demostración para Supabase (opcional) |

Tablas de Supabase: `products`, `categories`, `product_prices`, `sales`, `sale_items`, `inventory_movements` y `app_settings`.

- Los clientes solo pueden **leer** productos visibles, precios, categorías y configuración.
- Solo el administrador con sesión iniciada puede modificar datos y ver las ventas.

## Aviso legal

- La app pide confirmar la mayoría de edad antes de mostrar el catálogo.
- Solo guarda en el navegador la hora de esa confirmación.
- No guarda datos personales de clientes ni de compradores.
- Revisa con un asesor las normas vigentes sobre venta y publicidad de estos productos en tu país.
