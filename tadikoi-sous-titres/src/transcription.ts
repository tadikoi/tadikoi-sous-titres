// Moteur de reconnaissance vocale local (Vosk, WebAssembly) : aucun envoi audio sur internet.
import { createModel, type Model } from 'vosk-browser'
import { type Langue, urlModele } from './langues'
import { ponctuer } from './ponctuation'

type KaldiRecognizer = InstanceType<Model['KaldiRecognizer']>

export interface Rappels {
  surPartiel: (texte: string) => void
  surFinal: (texte: string) => void
  surErreur: (message: string) => void
}

const FREQUENCE = 16000 // format du micro des G2 : PCM 16 kHz, 16 bits signé, mono

export class Transcripteur {
  private modele: Model | null = null
  private reco: KaldiRecognizer | null = null
  langue: Langue | null = null

  /**
   * Charge le modèle d'une langue.
   * 1re fois : télécharge (internet requis) puis garde sur le téléphone.
   * Ensuite : lu depuis le téléphone, sans internet.
   */
  async charger(langue: Langue, rappels: Rappels): Promise<void> {
    if (this.langue?.code === langue.code && this.reco) return
    this.liberer() // une seule langue en mémoire à la fois

    this.modele = await createModel(urlModele(langue))
    this.reco = new this.modele.KaldiRecognizer(FREQUENCE)
    this.reco.setWords(true) // temps de chaque mot → virgules sur les pauses
    this.reco.on('partialresult', (m) => {
      if (m.event === 'partialresult') rappels.surPartiel(m.result.partial)
    })
    this.reco.on('result', (m) => {
      if (m.event === 'result' && m.result.text) {
        rappels.surFinal(ponctuer(m.result.text, langue.code, m.result.result))
      }
    })
    this.reco.on('error', (m) => {
      if (m.event === 'error') rappels.surErreur(m.error)
    })
    this.langue = langue
  }

  /** Reçoit un morceau d'audio brut venant des lunettes. */
  envoyerAudio(pcm: Uint8Array): void {
    if (!this.reco) return
    // Copie pour garantir l'alignement mémoire avant lecture en 16 bits.
    const octets = pcm.slice()
    const echantillons = new Int16Array(octets.buffer, 0, octets.byteLength >> 1)
    const flottants = new Float32Array(echantillons.length)
    for (let i = 0; i < echantillons.length; i++) flottants[i] = echantillons[i] / 32768
    this.reco.acceptWaveformFloat(flottants, FREQUENCE)
  }

  liberer(): void {
    try { this.reco?.remove() } catch { /* déjà libéré */ }
    try { this.modele?.terminate() } catch { /* déjà libéré */ }
    this.reco = null
    this.modele = null
    this.langue = null
  }
}

/** Télécharge un pack de langue sans lancer la transcription. */
export async function telecharger(langue: Langue): Promise<void> {
  const modele = await createModel(urlModele(langue))
  modele.terminate()
}
