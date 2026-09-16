// Reduce el tamaño de las fotos antes de guardarlas para que carguen rápido en celular.

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = function () {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto. Prueba con una imagen JPG o PNG.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(function (resolve) {
    canvas.toBlob(
      function (blob) {
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function optimizeImage(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  const image = await loadImage(file);
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Este navegador no puede procesar fotos.');
  }
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') {
    // Algunos iPhone antiguos no generan WebP: se usa JPG.
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  if (!blob) {
    throw new Error('No se pudo procesar la foto.');
  }
  return blob;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result));
    };
    reader.onerror = function () {
      reject(new Error('No se pudo leer la foto.'));
    };
    reader.readAsDataURL(blob);
  });
}
