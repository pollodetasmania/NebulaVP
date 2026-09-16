import { useRef, useState } from 'react';
import type { Availability, Category, DataStore, PriceOption, Product, ProductInput } from '../types';
import { ConfirmDialog, MoneyInput, Sheet, Stepper, showToast } from '../components/Common';
import { Icon } from '../components/Icon';
import { errorMessage, newId } from '../utils/format';
import { sortPrices } from '../utils/products';

// Formulario para agregar o editar un producto.

interface PriceRow {
  id: string;
  quantity: number;
  price: number | null;
}

interface Props {
  store: DataStore;
  product: Product | null; // null = producto nuevo
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function startingPrices(product: Product | null): PriceRow[] {
  if (product && product.prices.length > 0) {
    return sortPrices(product.prices).map(function (price) {
      return { id: price.id, quantity: price.quantity, price: price.price };
    });
  }
  return [
    { id: newId(), quantity: 1, price: null },
    { id: newId(), quantity: 2, price: null },
    { id: newId(), quantity: 3, price: null },
  ];
}

export function ProductEditor(props: Props) {
  const original = props.product;
  const [name, setName] = useState(original ? original.name : '');
  const [description, setDescription] = useState(original ? original.description : '');
  const [categoryId, setCategoryId] = useState(original && original.categoryId ? original.categoryId : '');
  const [sku, setSku] = useState(original ? original.sku : '');
  const [stock, setStock] = useState(original ? original.stock : 0);
  const [availability, setAvailability] = useState<Availability>(original ? original.availability : 'auto');
  const [visible, setVisible] = useState(original ? original.visible : true);
  const [prices, setPrices] = useState<PriceRow[]>(startingPrices(original));
  const [photo, setPhoto] = useState<{ ref: string | null; url: string | null }>({
    ref: original ? original.imageRef : null,
    url: original ? original.imageUrl : null,
  });
  const [uploadedRefs, setUploadedRefs] = useState<string[]>([]); // fotos subidas en esta edición
  const [categories, setCategories] = useState<Category[]>(props.categories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // ----- Foto -----
  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setUploading(true);
    setError('');
    try {
      const uploaded = await props.store.uploadImage(file);
      setPhoto({ ref: uploaded.ref, url: uploaded.url });
      setUploadedRefs(uploadedRefs.concat([uploaded.ref]));
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
    setUploading(false);
    if (fileInput.current) {
      fileInput.current.value = '';
    }
  }

  function removePhoto() {
    setPhoto({ ref: null, url: null });
  }

  // Al cerrar sin guardar se borran las fotos que se subieron y no se usaron.
  async function cleanUnusedUploads(keepRef: string | null) {
    for (const ref of uploadedRefs) {
      if (ref !== keepRef) {
        await props.store.deleteImage(ref);
      }
    }
  }

  function closeWithoutSaving() {
    cleanUnusedUploads(null);
    props.onClose();
  }

  // ----- Categorías -----
  async function createCategory() {
    const cleanName = newCategoryName.trim();
    if (cleanName === '') {
      return;
    }
    try {
      const id = await props.store.saveCategory(cleanName, null);
      const updated = categories.concat([{ id: id, name: cleanName, position: categories.length + 1 }]);
      setCategories(updated);
      setCategoryId(id);
      setNewCategoryName('');
      setAddingCategory(false);
    } catch (categoryError) {
      setError(errorMessage(categoryError));
    }
  }

  // ----- Precios -----
  function updatePrice(id: string, changes: Partial<PriceRow>) {
    setPrices(
      prices.map(function (row) {
        if (row.id === id) {
          return { ...row, ...changes };
        }
        return row;
      }),
    );
  }

  function addPrice() {
    let nextQuantity = 1;
    for (const row of prices) {
      if (row.quantity >= nextQuantity) {
        nextQuantity = row.quantity + 1;
      }
    }
    setPrices(prices.concat([{ id: newId(), quantity: nextQuantity, price: null }]));
  }

  function removePrice(id: string) {
    setPrices(
      prices.filter(function (row) {
        return row.id !== id;
      }),
    );
  }

  // ----- Guardar -----
  function validate(): { ok: true; prices: PriceOption[] } | { ok: false; message: string } {
    if (name.trim() === '') {
      return { ok: false, message: 'Escribe el nombre del producto.' };
    }
    const cleanPrices: PriceOption[] = [];
    const usedQuantities: number[] = [];
    for (const row of prices) {
      if (row.price === null) {
        continue; // las filas vacías se ignoran
      }
      if (row.quantity <= 0) {
        return { ok: false, message: 'La cantidad de cada precio debe ser 1 o más.' };
      }
      if (usedQuantities.includes(row.quantity)) {
        return { ok: false, message: 'Hay dos precios para ' + row.quantity + ' unidades. Deja solo uno.' };
      }
      usedQuantities.push(row.quantity);
      cleanPrices.push({ id: row.id, quantity: row.quantity, price: row.price });
    }
    if (cleanPrices.length === 0) {
      return { ok: false, message: 'Agrega al menos un precio.' };
    }
    return { ok: true, prices: sortPrices(cleanPrices) };
  }

  async function save() {
    const result = validate();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaving(true);
    setError('');
    const input: ProductInput = {
      id: original ? original.id : null,
      name: name.trim(),
      description: description.trim(),
      categoryId: categoryId === '' ? null : categoryId,
      sku: sku.trim(),
      stock: stock,
      availability: availability,
      visible: visible,
      prices: result.prices,
      imageRef: photo.ref,
      imageUrl: photo.url,
    };
    try {
      await props.store.saveProduct(input);
      // La foto anterior se borra solo después de guardar con éxito.
      if (original && original.imageRef && original.imageRef !== photo.ref) {
        await props.store.deleteImage(original.imageRef);
      }
      await cleanUnusedUploads(photo.ref);
      showToast(original ? 'Producto actualizado' : 'Producto guardado');
      await props.onSaved();
      props.onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!original) {
      return;
    }
    setSaving(true);
    try {
      await props.store.deleteProduct(original);
      await cleanUnusedUploads(null);
      showToast('Producto eliminado');
      await props.onSaved();
      props.onClose();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  const footer = (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={saving || uploading}>
        {saving ? 'Guardando…' : 'Guardar producto'}
      </button>
    </>
  );

  return (
    <Sheet title={original ? 'Editar producto' : 'Agregar producto'} onClose={closeWithoutSaving} footer={footer}>
      {/* FOTO */}
      <div className="field">
        <span className="field-label">Foto</span>
        <div className="photo-editor">
          {photo.url ? (
            <img src={photo.url} alt="Foto del producto" className="photo-editor-img" />
          ) : (
            <button
              type="button"
              className="photo-drop"
              onClick={function () {
                if (fileInput.current) {
                  fileInput.current.click();
                }
              }}
              disabled={uploading}
            >
              <Icon name="camera" size={30} />
              <span>{uploading ? 'Subiendo foto…' : 'Subir fotografía'}</span>
            </button>
          )}
          {photo.url ? (
            <div className="photo-editor-actions">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={uploading}
                onClick={function () {
                  if (fileInput.current) {
                    fileInput.current.click();
                  }
                }}
              >
                <Icon name="camera" size={18} /> {uploading ? 'Subiendo…' : 'Cambiar foto'}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={removePhoto} disabled={uploading}>
                <Icon name="trash" size={18} /> Quitar foto
              </button>
            </div>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="visually-hidden"
            aria-label="Elegir foto del producto"
            data-testid="photo-input"
            onChange={function (event) {
              handleFile(event.target.files ? event.target.files[0] : undefined);
            }}
          />
        </div>
      </div>

      {/* NOMBRE */}
      <label className="field">
        <span className="field-label">Nombre</span>
        <input
          className="input"
          value={name}
          maxLength={80}
          placeholder="Ejemplo: Nebula X"
          onChange={function (event) {
            setName(event.target.value);
          }}
        />
      </label>

      {/* DESCRIPCIÓN */}
      <label className="field">
        <span className="field-label">Descripción</span>
        <textarea
          className="input textarea"
          value={description}
          maxLength={600}
          rows={3}
          placeholder="Cuenta en pocas palabras qué es el producto"
          onChange={function (event) {
            setDescription(event.target.value);
          }}
        />
      </label>

      {/* CATEGORÍA */}
      <div className="field">
        <label className="field-label" htmlFor="product-category">
          Categoría
        </label>
        <div className="inline-row">
          <select
            id="product-category"
            className="input"
            value={categoryId}
            onChange={function (event) {
              setCategoryId(event.target.value);
            }}
          >
            <option value="">Sin categoría</option>
            {categories.map(function (category) {
              return (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="icon-button icon-button-boxed"
            aria-label="Crear categoría"
            onClick={function () {
              setAddingCategory(!addingCategory);
            }}
          >
            <Icon name="plus" />
          </button>
        </div>
        {addingCategory ? (
          <div className="inline-row inline-row-spaced">
            <input
              className="input"
              placeholder="Nombre de la nueva categoría"
              value={newCategoryName}
              onChange={function (event) {
                setNewCategoryName(event.target.value);
              }}
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={createCategory}>
              Crear
            </button>
          </div>
        ) : null}
      </div>

      {/* STOCK */}
      <div className="field">
        <span className="field-label">Stock (unidades)</span>
        <Stepper value={stock} min={0} onChange={setStock} label="Stock" />
      </div>

      {/* PRECIOS */}
      <div className="field">
        <span className="field-label">Precios</span>
        <p className="field-help">Escribe el precio total para cada cantidad. Las filas sin precio no se guardan.</p>
        <div className="price-editor">
          {prices.map(function (row, index) {
            return (
              <div className="price-editor-row" key={row.id}>
                <div className="price-editor-qty">
                  <input
                    className="input input-center"
                    inputMode="numeric"
                    aria-label={'Cantidad del precio ' + (index + 1)}
                    value={String(row.quantity)}
                    onChange={function (event) {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
                      updatePrice(row.id, { quantity: digits === '' ? 0 : Number(digits) });
                    }}
                  />
                  <span>{row.quantity === 1 ? 'unidad' : 'unidades'}</span>
                </div>
                <MoneyInput
                  id={'price-' + row.id}
                  label={'Precio para ' + row.quantity + ' unidades'}
                  value={row.price}
                  onChange={function (value) {
                    updatePrice(row.id, { price: value });
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Quitar este precio"
                  onClick={function () {
                    removePrice(row.id);
                  }}
                >
                  <Icon name="trash" size={20} />
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-ghost btn-block btn-small" onClick={addPrice}>
          <Icon name="plus" size={18} /> Agregar otro precio
        </button>
      </div>

      {/* DISPONIBILIDAD */}
      <label className="field">
        <span className="field-label">Disponibilidad</span>
        <select
          className="input"
          value={availability}
          onChange={function (event) {
            setAvailability(event.target.value as Availability);
          }}
        >
          <option value="auto">Automática (según el stock)</option>
          <option value="disponible">Siempre disponible</option>
          <option value="poco_stock">Poco stock</option>
          <option value="agotado">Agotado</option>
        </select>
      </label>

      <label className="toggle-row">
        <span>
          <strong>Mostrar en el catálogo</strong>
          <small>Si lo apagas, el producto queda oculto para los clientes.</small>
        </span>
        <input
          type="checkbox"
          className="toggle"
          checked={visible}
          onChange={function (event) {
            setVisible(event.target.checked);
          }}
        />
      </label>

      {/* SKU */}
      <label className="field">
        <span className="field-label">SKU (opcional)</span>
        <input
          className="input"
          value={sku}
          maxLength={40}
          placeholder="Código interno"
          onChange={function (event) {
            setSku(event.target.value);
          }}
        />
      </label>

      {original ? (
        <button
          type="button"
          className="btn btn-danger-ghost btn-block"
          onClick={function () {
            setConfirmDelete(true);
          }}
        >
          <Icon name="trash" size={18} /> Eliminar producto
        </button>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="¿Eliminar este producto?"
          message={'Se eliminará "' + name + '" y su foto. Las ventas anteriores se conservan en el historial.'}
          confirmLabel="Eliminar"
          danger={true}
          busy={saving}
          onConfirm={deleteProduct}
          onCancel={function () {
            setConfirmDelete(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}
