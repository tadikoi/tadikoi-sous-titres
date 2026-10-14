import './style.css'
import {
  waitForEvenAppBridge,
  AudioInputSource,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { LANGUES, type Langue, estInstallee, supprimer, demanderStockagePersistant, espaceUtilise } from './langues'
import { Transcripteur, telecharger } from './transcription'
import { EcranLunettes } from './lunettes'
import { EcranTelephone, MicroTelephone, stockageLocal, type Affichage } from './navigateur'

const CLE_LANGUE = 'langue_active'

// Dans l'app Even (et le simulateur), la page est hébergée par une webview Flutter
// qui expose window.flutter_inappwebview. Dans un navigateur ordinaire, cet objet
// n'existe pas : on passe alors en mode test (micro et écran du téléphone).
async function dansAppEven(): Promise<boolean> {
  for (let i = 0; i < 15; i++) {
    if ('flutter_inappwebview' in window) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}
const bridge: EvenAppBridge | null = (await dansAppEven()) ? await waitForEvenAppBridge() : null
const modeTest = bridge === null
const micro = new MicroTelephone()
let ecran: Affichage
if (bridge) {
  const lunettes = new EcranLunettes(bridge)
  await lunettes.creer('TADIKOI Sous-titres\n\nPréparation…')
  ecran = lunettes
} else {
  ecran = new EcranTelephone()
}
const lireStockage = (cle: string) => (bridge ? bridge.getLocalStorage(cle) : stockageLocal.get(cle))
const ecrireStockage = (cle: string, v: string) => (bridge ? bridge.setLocalStorage(cle, v) : stockageLocal.set(cle, v))
const transcripteur = new Transcripteur()

let enCours = false
let langueActive: Langue = LANGUES[0]
const enTelechargement = new Set<string>()

// ---------- Lunettes ----------

bridge?.onEvenHubEvent((event) => {
  if (event.audioEvent?.audioPcm && enCours) {
    transcripteur.envoyerAudio(event.audioEvent.audioPcm)
    return
  }
  const t = event.textEvent
  if (!t) return
  switch (t.eventType) {
    case OsEventTypeList.CLICK_EVENT:
    case undefined: // le SDK transforme parfois 0 en undefined
      void (enCours ? arreter() : demarrer())
      break
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      void arreter().then(() => bridge?.shutDownPageContainer(1))
      break
  }
})

async function demarrer(): Promise<void> {
  if (!(await estInstallee(langueActive))) {
    ecran.message(`${langueActive.nom} non téléchargé.\n\nOuvrez l'app sur le téléphone\npour télécharger la langue.`)
    return
  }
  ecran.message(`Chargement : ${langueActive.nom}…`)
  try {
    await transcripteur.charger(langueActive, {
      surPartiel: (t) => ecran.majPartiel(t),
      surFinal: (t) => ecran.ajouterFinal(t),
      surErreur: (m) => afficherEtat(`Erreur : ${m}`),
    })
  } catch (e) {
    ecran.message(`Impossible de charger\n${langueActive.nom}.\n\nRetéléchargez la langue\nsur le téléphone.`)
    afficherEtat(`Erreur de chargement : ${String(e)}`)
    return
  }
  if (bridge) {
    const ok = await bridge.audioControl(true, AudioInputSource.Glasses)
    if (!ok) {
      ecran.message('Micro des lunettes\nindisponible.')
      return
    }
  } else {
    try {
      await micro.demarrer((echantillons) => { if (enCours) transcripteur.envoyerFloat(echantillons) })
    } catch (e) {
      ecran.message('Micro du téléphone refusé.\nAutorisez le micro pour ce site dans Chrome.')
      afficherEtat(`Micro indisponible : ${String(e)}`)
      return
    }
  }
  enCours = true
  ecran.message(modeTest ? `● ${langueActive.nom} — parlez, les sous-titres s'affichent ici` : `● ${langueActive.nom} — à l'écoute\n(toucher pour arrêter)`)
  majInterface()
}

async function arreter(): Promise<void> {
  if (!enCours) return
  enCours = false
  if (bridge) await bridge.audioControl(false)
  else micro.arreter()
  ecran.message(`En pause — ${langueActive.nom}\n\nToucher : reprendre\nDouble toucher : quitter`)
  majInterface()
}

// ---------- Téléphone : gestion des langues ----------

const liste = document.querySelector<HTMLUListElement>('#langues')!
const etat = document.querySelector<HTMLParagraphElement>('#etat')!
const boutonDemarrer = document.querySelector<HTMLButtonElement>('#demarrer')!
const stockage = document.querySelector<HTMLParagraphElement>('#stockage')!

boutonDemarrer.addEventListener('click', () => void (enCours ? arreter() : demarrer()))

function afficherEtat(texte: string): void {
  etat.textContent = texte
}

async function majInterface(): Promise<void> {
  boutonDemarrer.textContent = enCours ? 'Arrêter les sous-titres' : 'Démarrer les sous-titres'
  boutonDemarrer.classList.toggle('actif', enCours)

  const lignes = await Promise.all(
    LANGUES.map(async (l) => ({ l, installee: await estInstallee(l) })),
  )
  liste.replaceChildren(
    ...lignes.map(({ l, installee }) => {
      const li = document.createElement('li')
      const choisie = l.code === langueActive.code

      const nom = document.createElement('button')
      nom.className = 'choix' + (choisie ? ' choisie' : '')
      nom.disabled = enCours
      nom.innerHTML = `<span class="nom">${l.nom}</span><span class="info">${
        enTelechargement.has(l.code) ? 'Téléchargement…' : installee ? 'Disponible hors ligne' : `${l.tailleMo} Mo à télécharger`
      }</span>`
      nom.addEventListener('click', () => void choisir(l))

      const action = document.createElement('button')
      action.className = 'action'
      action.disabled = enCours || enTelechargement.has(l.code)
      if (installee) {
        action.textContent = 'Supprimer'
        action.addEventListener('click', () => void retirer(l))
      } else {
        action.textContent = 'Télécharger'
        action.addEventListener('click', () => void installer(l))
      }
      li.append(nom, action)
      return li
    }),
  )
  stockage.textContent = await espaceUtilise()
}

async function choisir(l: Langue): Promise<void> {
  langueActive = l
  await ecrireStockage(CLE_LANGUE, l.code)
  ecran.message(`Langue : ${l.nom}\n\nToucher pour démarrer`)
  void majInterface()
}

async function installer(l: Langue): Promise<void> {
  if (!navigator.onLine) {
    afficherEtat('Connexion internet nécessaire pour télécharger une langue.')
    return
  }
  enTelechargement.add(l.code)
  afficherEtat(`Téléchargement de ${l.nom} (${l.tailleMo} Mo)…`)
  void majInterface()
  try {
    await telecharger(l)
    afficherEtat(`${l.nom} est prêt : fonctionne maintenant sans internet.`)
  } catch (e) {
    afficherEtat(`Échec du téléchargement de ${l.nom}. Vérifiez la connexion. (${String(e)})`)
  } finally {
    enTelechargement.delete(l.code)
    void majInterface()
  }
}

async function retirer(l: Langue): Promise<void> {
  if (!confirm(`Supprimer ${l.nom} du téléphone ? Il faudra le retélécharger pour l'utiliser.`)) return
  if (transcripteur.langue?.code === l.code) transcripteur.liberer()
  await supprimer(l)
  afficherEtat(`${l.nom} supprimé.`)
  void majInterface()
}

// ---------- Démarrage ----------

const persistant = await demanderStockagePersistant()
const codeSauve = await lireStockage(CLE_LANGUE)
langueActive = LANGUES.find((l) => l.code === codeSauve) ?? LANGUES[0]

if (await estInstallee(langueActive)) {
  ecran.message(`TADIKOI Sous-titres\n${langueActive.nom}\n\nToucher pour démarrer`)
  afficherEtat(`Prêt. Langue : ${langueActive.nom}.`)
} else {
  ecran.message(`Aucune langue installée.\n\nOuvrez l'app sur le téléphone\npour télécharger une langue.`)
  afficherEtat('Téléchargez au moins une langue (connexion internet nécessaire une seule fois).')
}
if (!persistant) {
  stockage.dataset.alerte = 'Le téléphone peut effacer les langues si la mémoire est pleine.'
}
void majInterface()
