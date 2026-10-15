// Mode test sans lunettes : l'app ouverte dans un navigateur (Chrome sur téléphone).
// Le micro du téléphone remplace celui des lunettes, et les sous-titres
// s'affichent directement sur l'écran du téléphone.

/** Même interface que l'écran des lunettes, pour que main.ts les utilise pareil. */
export interface Affichage {
  message(texte: string): void
  ajouterFinal(texte: string): void
  majPartiel(texte: string): void
}

const MAX_PHRASES = 6

export class EcranTelephone implements Affichage {
  private zone: HTMLDivElement
  private finals: string[] = []
  private partiel = ''

  constructor() {
    this.zone = document.createElement('div')
    this.zone.setAttribute('aria-live', 'polite')
    Object.assign(this.zone.style, {
      background: '#000',
      color: '#5dff9a',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '1.25rem',
      lineHeight: '1.4',
      padding: '14px 16px',
      borderRadius: '12px',
      minHeight: '9em',
      marginTop: '16px',
      whiteSpace: 'pre-wrap',
    })
    const titre = document.createElement('p')
    titre.textContent = 'Mode test sans lunettes : sous-titres ci-dessous'
    titre.style.cssText = 'margin:16px 0 0;font-weight:600'
    const avant = document.querySelector('#etat')
    avant?.after(titre, this.zone)
  }

  message(texte: string): void {
    this.finals = []
    this.partiel = ''
    this.zone.textContent = texte
  }

  ajouterFinal(texte: string): void {
    this.finals.push(texte)
    this.finals = this.finals.slice(-MAX_PHRASES)
    this.partiel = ''
    this.rendre()
  }

  majPartiel(texte: string): void {
    this.partiel = texte
    this.rendre()
  }

  private rendre(): void {
    this.zone.textContent = [...this.finals, this.partiel].filter(Boolean).join('\n')
  }
}

/** Micro du téléphone, converti au format attendu (16 kHz mono). */
export class MicroTelephone {
  private contexte: AudioContext | null = null
  private flux: MediaStream | null = null
  private noeud: ScriptProcessorNode | null = null

  async demarrer(surAudio: (echantillons: Float32Array) => void): Promise<void> {
    this.flux = await navigator.mediaDevices.getUserMedia({
      // Filtres de Chrome activés (anti-bruit, anti-écho, volume automatique).
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    })
    // Chrome rééchantillonne lui-même le micro à 16 kHz.
    this.contexte = new AudioContext({ sampleRate: 16000 })
    const source = this.contexte.createMediaStreamSource(this.flux)
    this.noeud = this.contexte.createScriptProcessor(4096, 1, 1)
    this.noeud.onaudioprocess = (e) => surAudio(new Float32Array(e.inputBuffer.getChannelData(0)))
    source.connect(this.noeud)
    this.noeud.connect(this.contexte.destination)
  }

  arreter(): void {
    this.noeud?.disconnect()
    this.flux?.getTracks().forEach((t) => t.stop())
    void this.contexte?.close()
    this.noeud = null
    this.flux = null
    this.contexte = null
  }
}

/** Stockage simple quand l'app n'est pas dans Even. */
export const stockageLocal = {
  async get(cle: string): Promise<string> {
    try { return localStorage.getItem(cle) ?? '' } catch { return '' }
  },
  async set(cle: string, valeur: string): Promise<void> {
    try { localStorage.setItem(cle, valeur) } catch { /* ignoré */ }
  },
}
