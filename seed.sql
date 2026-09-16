-- =====================================================================
-- DATOS DE DEMOSTRACIÓN (opcional)
-- Productos FICTICIOS para probar la app. No tienen fotos.
-- Ejecútalo después de schema.sql. Para borrarlos más tarde:
--   delete from products where is_demo = true;
-- =====================================================================

do $$
declare
  v_vapes uuid;
  v_accessories uuid;
  v_product uuid;
begin
  insert into categories (name, position) values ('Vaporizadores', 1) returning id into v_vapes;
  insert into categories (name, position) values ('Accesorios', 2) returning id into v_accessories;
  insert into categories (name, position) values ('Otros', 3);

  insert into products (name, description, category_id, sku, stock, is_demo)
  values ('Nebula X', 'Producto de demostración. Reemplaza este texto con la descripción real del producto.', v_vapes, 'DEMO-X', 12, true)
  returning id into v_product;
  insert into product_prices (product_id, quantity, price) values (v_product, 1, 35000), (v_product, 2, 65000), (v_product, 3, 90000);

  insert into products (name, description, category_id, sku, stock, is_demo)
  values ('Nebula Pro', 'Producto de demostración con poco stock.', v_vapes, 'DEMO-PRO', 4, true)
  returning id into v_product;
  insert into product_prices (product_id, quantity, price) values (v_product, 1, 45000), (v_product, 2, 85000);

  insert into products (name, description, category_id, sku, stock, is_demo)
  values ('Nebula Air', 'Producto de demostración.', v_vapes, 'DEMO-AIR', 20, true)
  returning id into v_product;
  insert into product_prices (product_id, quantity, price) values (v_product, 1, 30000), (v_product, 2, 55000), (v_product, 3, 78000);

  insert into products (name, description, category_id, sku, stock, is_demo)
  values ('Nebula Max', 'Producto de demostración agotado.', v_vapes, 'DEMO-MAX', 0, true)
  returning id into v_product;
  insert into product_prices (product_id, quantity, price) values (v_product, 1, 60000);

  insert into products (name, description, category_id, sku, stock, is_demo)
  values ('Cable USB-C Nebula', 'Accesorio de demostración.', v_accessories, 'DEMO-USB', 15, true)
  returning id into v_product;
  insert into product_prices (product_id, quantity, price) values (v_product, 1, 15000), (v_product, 2, 26000);
end $$;
