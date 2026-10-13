// Packs de langue : téléchargés une fois, puis conservés sur le téléphone.
//
// vosk-browser met lui-même en cache le modèle décompressé dans IndexedDB
// (base "/vosk", clés "/vosk/<url assainie>/..."). Tant qu'on lui redonne
// exactement la même URL, il retrouve le modèle sans rien télécharger :
// c'est ce qui rend la transcription possible hors ligne.

/** Adresse où sont hébergés les fichiers .tar.gz (voir scripts/preparer-modeles.sh). */
export const HEBERGEMENT_MODELES = 'https://tadikoi.github.io/tadikoi-sous-titres/tadikoi-sous-titres/modeles'

export interface Langue {
  code: string
  nom: string
  fichier: string
  tailleMo: number
}

export const LANGUES: Langue[] = [
  { code: 'fr', nom: 'Français', fichier: 'vosk-model-small-fr-0.22.tar.gz', tailleMo: 41 },
  { code: 'en', nom: 'Anglais', fichier: 'vosk-model-small-en-us-0.15.tar.gz', tailleMo: 40 },
  { code: 'es', nom: 'Espagnol', fichier: 'vosk-model-small-es-0.42.tar.gz', tailleMo: 39 },
  { code: 'de', nom: 'Allemand', fichier: 'vosk-model-small-de-0.15.tar.gz', tailleMo: 45 },
  { code: 'it', nom: 'Italien', fichier: 'vosk-model-small-it-0.22.tar.gz', tailleMo: 48 },
]

export function urlModele(l: Langue): string {
  return `${HEBERGEMENT_MODELES}/${l.fichier}`
}

const BASE_IDB = '/vosk'
const MAGASIN = 'FILE_DATA'

/** Préfixe de clé utilisé par vosk-browser pour ce modèle. */
function prefixe(l: Langue): string {
  return `${BASE_IDB}/${urlModele(l).replace(/[\W]/g, '_')}`
}

function ouvrirBase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(BASE_IDB)
      req.onupgradeneeded = () => {
        // La base n'existait pas encore : rien n'a été téléchargé.
        req.transaction?.abort()
        resolve(null)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Vrai si le modèle complet (décompressé) est présent sur le téléphone. */
export async function estInstallee(l: Langue): Promise<boolean> {
  const db = await ouvrirBase()
  if (!db || !db.objectStoreNames.contains(MAGASIN)) return false
  return new Promise((resolve) => {
    const req = db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).getKey(`${prefixe(l)}/extracted.ok`)
    req.onsuccess = () => { resolve(req.result !== undefined); db.close() }
    req.onerror = () => { resolve(false); db.close() }
  })
}

/** Supprime le modèle d'une langue pour libérer de la place. */
export async function supprimer(l: Langue): Promise<void> {
  const db = await ouvrirBase()
  if (!db || !db.objectStoreNames.contains(MAGASIN)) return
  const p = prefixe(l)
  await new Promise<void>((resolve) => {
    const tx = db.transaction(MAGASIN, 'readwrite')
    tx.objectStore(MAGASIN).delete(IDBKeyRange.bound(p, p + '￿'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

/** Demande au navigateur de ne pas effacer le stockage (utile surtout sur iPhone). */
export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch { /* non disponible dans certaines webviews */ }
  return false
}

export async function espaceUtilise(): Promise<string> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (e?.usage !== undefined) return `${Math.round(e.usage / 1e6)} Mo utilisés`
  } catch { /* ignoré */ }
  return ''
}
