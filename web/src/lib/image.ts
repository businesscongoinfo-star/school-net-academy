/**
 * Préparation des photos d'identité côté navigateur.
 *
 * Les photos sont redimensionnées puis compressées en JPEG avant l'envoi :
 * une photo de téléphone de 4 Mo devient une vignette de 20 à 40 ko, ce qui
 * reste raisonnable pour la base et pour la sauvegarde Supabase.
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* certains formats (HEIC…) ne passent pas : on tente l'élément <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Cette image n'a pas pu être lue."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file: File, { maxSize = 480, quality = 0.82 } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choisissez un fichier image (JPG, PNG ou WebP).');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image trop lourde : 15 Mo maximum.');
  }

  const source = await loadImage(file);
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;
  if (!width || !height) throw new Error("Cette image n'a pas pu être lue.");

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ce navigateur ne permet pas de préparer la photo.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);
  if ('close' in source) source.close();

  return canvas.toDataURL('image/jpeg', quality);
}

/** Photo principale (480 px) + vignette (112 px) pour les listes. */
export async function preparePhoto(file: File): Promise<{ photo: string; photoThumb: string }> {
  const photo = await compressImage(file, { maxSize: 480, quality: 0.82 });
  const photoThumb = await compressImage(file, { maxSize: 112, quality: 0.72 });
  return { photo, photoThumb };
}
