// Ponctuation automatique, 100 % locale et instantanée.
//
// Vosk renvoie du texte brut (sans majuscules ni ponctuation). On le reconstruit à partir de :
//  1. les pauses de la voix : Vosk coupe une phrase à chaque silence → point final ;
//     une pause courte à l'intérieur d'une phrase → virgule ;
//  2. des règles de langue : mots interrogatifs → « ? », virgule avant « mais », « donc »…,
//     après « bonjour », « oui », « alors »… en début de phrase.
// Ce n'est pas parfait (l'intonation n'est pas analysée), mais c'est léger et sans latence.

export interface Mot {
  word: string
  start: number // secondes
  end: number
}

interface Regles {
  /** Débuts de phrase qui signalent une question. */
  questions: string[]
  /** Mots n'importe où dans la phrase qui signalent une question (inversion, tag final…). */
  marqueursQuestion?: RegExp
  /** Virgule AVANT ces mots (s'ils ne commencent pas la phrase). */
  virguleAvant: string[]
  /** Virgule APRÈS ces mots s'ils ouvrent la phrase. */
  virguleApresDebut: string[]
  /** Espace insécable avant ? ! : ; (typographie française). */
  espaceAvantSigne?: boolean
  /** Point d'interrogation ouvrant (espagnol). */
  questionOuvrante?: boolean
}

const REGLES: Record<string, Regles> = {
  fr: {
    questions: [
      "est-ce que", "est-ce qu'", "qu'est-ce", "pourquoi", "comment", "combien", "quand", "où",
      "qui", "quoi", "quel", "quelle", "quels", "quelles", "lequel", "laquelle", "lesquels", "lesquelles",
      "avez-vous", "êtes-vous", "pouvez-vous", "voulez-vous", "savez-vous", "as-tu", "es-tu", "peux-tu", "veux-tu", "sais-tu",
    ],
    marqueursQuestion: /(?<!rendez)-(tu|vous|t-il|t-elle|t-on|il|elle|on|ils|elles)\b|\bn'est-ce pas$|\bc'est ça$|\bhein$/,
    virguleAvant: ["mais", "donc", "car", "sinon", "puisque", "alors que", "parce que", "c'est-à-dire"],
    virguleApresDebut: [
      "bonjour", "bonsoir", "salut", "merci", "oui", "non", "si", "alors", "bon", "bref", "enfin",
      "voilà", "d'accord", "ok", "ensuite", "puis", "après", "en fait", "du coup", "par contre", "pardon", "excusez-moi",
    ],
    espaceAvantSigne: true,
  },
  en: {
    questions: [
      "what", "why", "how", "when", "where", "who", "whom", "whose", "which",
      "do", "does", "did", "is", "are", "was", "were", "can", "could", "would", "will", "should", "shall",
    ],
    marqueursQuestion: /\b(right|isn't it|aren't you|don't you)$/,
    virguleAvant: ["but", "so", "because", "although", "though"],
    virguleApresDebut: ["hello", "hi", "thanks", "yes", "no", "well", "so", "okay", "ok", "actually", "anyway", "sorry", "please"],
  },
  es: {
    questions: [
      "qué", "por qué", "cómo", "cuándo", "dónde", "quién", "quiénes", "cuál", "cuáles", "cuánto", "cuánta", "cuántos", "cuántas",
    ],
    marqueursQuestion: /\bverdad$/,
    virguleAvant: ["pero", "porque", "aunque", "sino"],
    virguleApresDebut: ["hola", "gracias", "sí", "no", "bueno", "pues", "entonces", "vale", "claro", "perdón"],
    questionOuvrante: true,
  },
  de: {
    questions: [
      "was", "warum", "wieso", "weshalb", "wie", "wann", "wo", "woher", "wohin", "wer", "wen", "wem", "welche", "welcher", "welches",
      "hast du", "haben sie", "bist du", "sind sie", "kannst du", "können sie", "willst du", "wollen sie", "gibt es",
    ],
    marqueursQuestion: /\b(oder|nicht wahr)$/,
    virguleAvant: ["aber", "sondern", "dass", "weil", "obwohl", "wenn", "denn"],
    virguleApresDebut: ["hallo", "danke", "ja", "nein", "also", "gut", "okay", "ok", "entschuldigung", "bitte"],
  },
  it: {
    questions: [
      "che cosa", "cosa", "perché", "come", "quando", "dove", "chi", "quale", "quali", "quanto", "quanta", "quanti", "quante",
    ],
    marqueursQuestion: /\bvero$/,
    virguleAvant: ["ma", "però", "quindi", "perché", "anche se"],
    virguleApresDebut: ["ciao", "buongiorno", "grazie", "sì", "no", "allora", "bene", "beh", "ecco", "va bene", "scusi"],
  },
}

const PAUSE_VIRGULE_S = 0.35 // pause intra-phrase (secondes) traduite en virgule
const NBSP = ' '

/** Transforme un résultat brut de Vosk en phrase ponctuée. */
export function ponctuer(texteBrut: string, langue: string, mots?: Mot[]): string {
  const r = REGLES[langue] ?? REGLES.en
  const brut = texteBrut.trim().toLowerCase()
  if (!brut) return ''

  // 1. Virgules sur les pauses courtes (si Vosk a fourni les temps de chaque mot).
  let morceaux: string[]
  if (mots && mots.length > 1) {
    morceaux = mots.map((m, i) => {
      const suivant = mots[i + 1]
      const pause = suivant ? suivant.start - m.end : 0
      return pause >= PAUSE_VIRGULE_S ? `${m.word},` : m.word
    })
  } else {
    morceaux = brut.split(/\s+/)
  }
  let phrase = morceaux.join(' ')

  // 2. Virgule après une interjection d'ouverture (« bonjour », « alors »…).
  for (const debut of trierLongueur(r.virguleApresDebut)) {
    if (phrase === debut) break
    if (phrase.startsWith(debut + ' ')) {
      phrase = debut + ',' + phrase.slice(debut.length)
      break
    }
  }

  // 3. Virgule avant les conjonctions (« mais », « donc »…), hors début de phrase.
  for (const conj of trierLongueur(r.virguleAvant)) {
    const motif = new RegExp(`([^,\\s])\\s+(${echapper(conj)})(?=\\s)`, 'g')
    phrase = phrase.replace(motif, '$1, $2')
  }

  // 4. Question ou affirmation ?
  const sansVirgule = phrase.replace(/,/g, '')
  const estQuestion =
    commenceParMot(sansVirgule, r.questions) || (r.marqueursQuestion?.test(sansVirgule) ?? false)

  // Nettoyage : pas de virgule finale, pas de doublon.
  phrase = phrase.replace(/,+/g, ',').replace(/,\s*$/, '')

  // 5. Signe final et typographie.
  const espace = r.espaceAvantSigne ? NBSP : ''
  phrase = majuscule(phrase)
  if (estQuestion) {
    phrase = (r.questionOuvrante ? '¿' : '') + phrase + espace + '?'
  } else {
    phrase = phrase + '.'
  }
  // Pronom « i » anglais toujours en majuscule.
  if (langue === 'en') phrase = phrase.replace(/\bi\b/g, 'I').replace(/\bi'(m|ll|ve|d)\b/g, "I'$1")
  return phrase
}

function commenceParMot(phrase: string, liste: string[]): boolean {
  // Vérifie que la correspondance est un mot entier (« qui » mais pas « quitter »),
  // sauf pour les formes élidées qui finissent par une apostrophe.
  return liste.some((q) => {
    if (!phrase.startsWith(q)) return false
    if (q.endsWith("'")) return true
    const apres = phrase.charAt(q.length)
    return apres === '' || apres === ' ' || apres === '-'
  })
}

function majuscule(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function trierLongueur(liste: string[]): string[] {
  return [...liste].sort((a, b) => b.length - a.length)
}

function echapper(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
