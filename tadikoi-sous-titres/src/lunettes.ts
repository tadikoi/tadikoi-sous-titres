// Affichage des sous-titres sur l'écran des lunettes (576 × 288 px, texte vert).
import {
  type EvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'

const ID = 1
const NOM = 'soustitres'
// Un écran plein contient ~400-500 caractères ; on garde de la marge
// pour que la dernière phrase reste toujours visible sans défiler.
const MAX_CARACTERES = 260
const INTERVALLE_MS = 150 // limite le trafic Bluetooth

export class EcranLunettes {
  private finals: string[] = []
  private partiel = ''
  private derniereEnvoi = 0
  private minuteur: ReturnType<typeof setTimeout> | null = null

  constructor(private bridge: EvenAppBridge) {}

  async creer(texte: string): Promise<boolean> {
    const resultat = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [
          new TextContainerProperty({
            xPosition: 0,
            yPosition: 0,
            width: 576,
            height: 288,
            borderWidth: 0,
            borderColor: 5,
            paddingLength: 6,
            containerID: ID,
            containerName: NOM,
            content: texte,
            isEventCapture: 1,
          }),
        ],
      }),
    )
    return resultat === 0
  }

  /** Message fixe (état, consignes). */
  message(texte: string): void {
    this.finals = []
    this.partiel = ''
    void this.envoyer(texte)
  }

  ajouterFinal(texte: string): void {
    this.finals.push(texte) // déjà ponctué
    this.partiel = ''
    this.planifier()
  }

  majPartiel(texte: string): void {
    if (texte === this.partiel) return
    this.partiel = texte
    this.planifier()
  }

  private composer(): string {
    let texte = this.finals.join('\n')
    if (this.partiel) texte += (texte ? '\n' : '') + this.partiel
    if (texte.length > MAX_CARACTERES) {
      // On coupe au début, sur une frontière de mot.
      texte = texte.slice(texte.length - MAX_CARACTERES)
      texte = texte.slice(texte.search(/\s/) + 1)
      this.finals = this.finals.slice(-3)
    }
    return texte || ' '
  }

  private planifier(): void {
    const attente = INTERVALLE_MS - (Date.now() - this.derniereEnvoi)
    if (attente <= 0) {
      void this.envoyer(this.composer())
    } else if (!this.minuteur) {
      this.minuteur = setTimeout(() => {
        this.minuteur = null
        void this.envoyer(this.composer())
      }, attente)
    }
  }

  private async envoyer(texte: string): Promise<void> {
    this.derniereEnvoi = Date.now()
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: ID, containerName: NOM, content: texte }),
    )
  }
}
