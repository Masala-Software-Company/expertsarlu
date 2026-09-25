/** Refuse logos / documents paysage — la photo patient doit être un portrait. */
export async function validatePatientPortrait(file: File): Promise<string | null> {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Formats acceptés : JPG, JPEG ou PNG';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Fichier trop volumineux (max. 5 Mo)';
  }

  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('invalid'));
      img.src = url;
    });
    if (dims.w < 80 || dims.h < 80) {
      return 'Photo trop petite — utilisez une photo nette du visage.';
    }
    // Logos / bannières (ex. 1024×559) : ratio très paysage
    if (dims.w / dims.h > 1.45) {
      return 'Utilisez une photo portrait du patient (visage), pas un logo ni un document.';
    }
    return null;
  } catch {
    return 'Impossible de lire cette image.';
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Évite d’afficher un logo paysage dans la carte de suivi. */
export function isLikelyPortraitUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / Math.max(img.naturalHeight, 1);
      resolve(ratio <= 1.45);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
