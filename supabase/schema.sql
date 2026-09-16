-- =====================================================================
-- NEBULA — base de datos para Supabase
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category_id uuid references categories(id) on delete set null,
  sku text not null default '',
  stock int not null default 0 check (stock >= 0),
  availability text not null default 'auto'
    check (availability in ('auto', 'disponible', 'poco_stock', 'agotado')),
  visible boolean not null default true,
  image_path text,
  image_url text,
  is_demo boolean not null default false, -- true = producto de demostración
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  price numeric(12, 0) not null check (price >= 0),
  unique (product_id, quantity)
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'activa' check (status in ('activa', 'anulada')),
  cancelled_at timestamptz,
  total numeric(12, 0) not null default 0
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  price_label text not null default '',
  line_total numeric(12, 0) not null default 0
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  change int not null,
  reason text not null check (reason in ('inicial', 'ajuste', 'venta', 'anulacion')),
  sale_id uuid references sales(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  whatsapp_number text not null default '',
  tagline text not null default 'Explore the nebula',
  low_stock_threshold int not null default 5,
  legal_notice text not null default 'Venta exclusiva para mayores de 18 años. Los productos con nicotina son adictivos y afectan la salud.'
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

create index if not exists sales_created_at_idx on sales (created_at desc);
create index if not exists product_prices_product_idx on product_prices (product_id);

-- ---------- Permisos (Row Level Security) ----------
-- Clientes (sin sesión): solo ven productos visibles, precios, categorías y ajustes.
-- Administrador (con sesión): puede hacer todo.
-- IMPORTANTE: en Authentication > Sign In / Providers desactiva "Allow new users to sign up"
-- para que nadie más pueda crear una cuenta.

alter table categories enable row level security;
alter table products enable row level security;
alter table product_prices enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table inventory_movements enable row level security;
alter table app_settings enable row level security;

drop policy if exists "leer categorias" on categories;
create policy "leer categorias" on categories for select to anon, authenticated using (true);
drop policy if exists "admin categorias" on categories;
create policy "admin categorias" on categories for all to authenticated using (true) with check (true);

drop policy if exists "leer productos visibles" on products;
create policy "leer productos visibles" on products for select to anon using (visible = true);
drop policy if exists "admin productos" on products;
create policy "admin productos" on products for all to authenticated using (true) with check (true);

drop policy if exists "leer precios visibles" on product_prices;
create policy "leer precios visibles" on product_prices for select to anon
  using (exists (select 1 from products p where p.id = product_id and p.visible = true));
drop policy if exists "admin precios" on product_prices;
create policy "admin precios" on product_prices for all to authenticated using (true) with check (true);

drop policy if exists "leer ajustes" on app_settings;
create policy "leer ajustes" on app_settings for select to anon, authenticated using (true);
drop policy if exists "admin ajustes" on app_settings;
create policy "admin ajustes" on app_settings for update to authenticated using (true) with check (true);

drop policy if exists "admin ventas" on sales;
create policy "admin ventas" on sales for all to authenticated using (true) with check (true);
drop policy if exists "admin items" on sale_items;
create policy "admin items" on sale_items for all to authenticated using (true) with check (true);
drop policy if exists "admin movimientos" on inventory_movements;
create policy "admin movimientos" on inventory_movements for all to authenticated using (true) with check (true);

-- ---------- Funciones (se ejecutan completas o no se ejecutan) ----------

-- Guardar producto con sus precios.
create or replace function save_product(p_product jsonb, p_prices jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_old_stock int;
  v_new_stock int;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  v_new_stock := greatest(coalesce((p_product->>'stock')::int, 0), 0);

  if coalesce(p_product->>'id', '') = '' then
    insert into products (name, description, category_id, sku, stock, availability, visible, image_path, image_url)
    values (
      p_product->>'name',
      coalesce(p_product->>'description', ''),
      nullif(p_product->>'category_id', '')::uuid,
      coalesce(p_product->>'sku', ''),
      v_new_stock,
      coalesce(p_product->>'availability', 'auto'),
      coalesce((p_product->>'visible')::boolean, true),
      nullif(p_product->>'image_path', ''),
      nullif(p_product->>'image_url', '')
    )
    returning id into v_id;

    if v_new_stock <> 0 then
      insert into inventory_movements (product_id, change, reason) values (v_id, v_new_stock, 'inicial');
    end if;
  else
    v_id := (p_product->>'id')::uuid;

    select stock into v_old_stock from products where id = v_id for update;
    if not found then
      raise exception 'El producto ya no existe.';
    end if;

    update products set
      name = p_product->>'name',
      description = coalesce(p_product->>'description', ''),
      category_id = nullif(p_product->>'category_id', '')::uuid,
      sku = coalesce(p_product->>'sku', ''),
      stock = v_new_stock,
      availability = coalesce(p_product->>'availability', 'auto'),
      visible = coalesce((p_product->>'visible')::boolean, true),
      image_path = nullif(p_product->>'image_path', ''),
      image_url = nullif(p_product->>'image_url', ''),
      updated_at = now()
    where id = v_id;

    if v_new_stock <> v_old_stock then
      insert into inventory_movements (product_id, change, reason) values (v_id, v_new_stock - v_old_stock, 'ajuste');
    end if;
  end if;

  delete from product_prices where product_id = v_id;

  insert into product_prices (product_id, quantity, price)
  select v_id, (item->>'quantity')::int, (item->>'price')::numeric
  from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) as item;

  return v_id;
end;
$$;

-- Corregir el stock a mano.
create or replace function set_stock(p_product_id uuid, p_new_stock int)
returns void
language plpgsql
as $$
declare
  v_old_stock int;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_new_stock < 0 then
    raise exception 'El stock no puede ser negativo.';
  end if;

  select stock into v_old_stock from products where id = p_product_id for update;
  if not found then
    raise exception 'El producto ya no existe.';
  end if;

  if p_new_stock <> v_old_stock then
    update products set stock = p_new_stock, updated_at = now() where id = p_product_id;
    insert into inventory_movements (product_id, change, reason)
    values (p_product_id, p_new_stock - v_old_stock, 'ajuste');
  end if;
end;
$$;

-- Registrar una venta y descontar el stock. Devuelve el stock nuevo.
create or replace function register_sale(p_product_id uuid, p_quantity int, p_price_label text, p_total numeric)
returns int
language plpgsql
as $$
declare
  v_stock int;
  v_name text;
  v_sale_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  select stock, name into v_stock, v_name from products where id = p_product_id for update;
  if not found then
    raise exception 'El producto ya no existe.';
  end if;
  if v_stock < p_quantity then
    raise exception 'No hay suficiente stock. Disponible: %.', v_stock;
  end if;

  update products set stock = stock - p_quantity, updated_at = now() where id = p_product_id;

  insert into sales (total) values (p_total) returning id into v_sale_id;

  insert into sale_items (sale_id, product_id, product_name, quantity, price_label, line_total)
  values (v_sale_id, p_product_id, v_name, p_quantity, coalesce(p_price_label, ''), p_total);

  insert into inventory_movements (product_id, change, reason, sale_id)
  values (p_product_id, -p_quantity, 'venta', v_sale_id);

  return v_stock - p_quantity;
end;
$$;

-- Anular una venta y devolver las unidades.
create or replace function cancel_sale(p_sale_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select status into v_status from sales where id = p_sale_id for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_status = 'anulada' then
    return;
  end if;

  for v_item in select product_id, quantity from sale_items where sale_id = p_sale_id loop
    if v_item.product_id is not null then
      update products set stock = stock + v_item.quantity, updated_at = now() where id = v_item.product_id;
      insert into inventory_movements (product_id, change, reason, sale_id)
      values (v_item.product_id, v_item.quantity, 'anulacion', p_sale_id);
    end if;
  end loop;

  update sales set status = 'anulada', cancelled_at = now() where id = p_sale_id;
end;
$$;

revoke execute on function save_product(jsonb, jsonb) from anon;
revoke execute on function set_stock(uuid, int) from anon;
revoke execute on function register_sale(uuid, int, text, numeric) from anon;
revoke execute on function cancel_sale(uuid) from anon;

-- ---------- Fotos (Supabase Storage) ----------
-- Carpeta pública "product-images": cualquiera ve las fotos, solo el administrador sube o borra.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "admin cambia fotos" on storage.objects;
create policy "admin cambia fotos" on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
