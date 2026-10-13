# TADIKOI Sous-titres — transcription hors ligne pour Even G2

App Even Hub qui affiche en sous-titres sur les lunettes ce que disent les interlocuteurs.
La reconnaissance vocale tourne **sur le téléphone** (Vosk en WebAssembly) : une fois une
langue téléchargée, tout fonctionne en mode avion. Seul le Bluetooth lunettes ↔ téléphone reste nécessaire.

## Utilisation

- **Sur le téléphone** : choisir une langue, appuyer sur « Télécharger » (une seule fois, avec internet), puis « Démarrer les sous-titres ».
- **Sur les lunettes** : toucher = démarrer / pause, double toucher = quitter.
- Chaque langue peut être supprimée pour libérer de la place.

## Mise en route (développeur)

1. Outils Even Hub : Node.js, CLI `evenhub` et simulateur — voir https://hub.evenrealities.com/docs/get-started/quickstart/install-tools
2. `npm install`
3. **Préparer et héberger les langues** :
   - `bash scripts/preparer-modeles.sh` → crée `modeles/*.tar.gz` (≈ 40-50 Mo chacun)
   - Les mettre en ligne en HTTPS avec l'en-tête `Access-Control-Allow-Origin: *`
     (ex. GitHub Pages, Cloudflare R2, ou un sous-domaine de tadikoiaccess.fr)
   - Remplacer `REMPLACER-PAR-VOTRE-HEBERGEMENT` dans `src/langues.ts` **et** dans la `whitelist` de `app.json`
4. Test sur les lunettes : `npm run dev`, puis `evenhub qr --url "http://<IP-de-l-ordinateur>:5173"` et scanner le QR avec l'app Even (mode développeur activé).
5. Paquet final : `npm run pack` → `tadikoi-sous-titres.ehpk`

## À vérifier en priorité sur un vrai téléphone

1. **iPhone** : la langue est-elle toujours là après avoir fermé l'app Even, redémarré le téléphone, puis quelques jours sans utilisation ?
2. **Hors ligne** : mode avion activé (Bluetooth rallumé), la transcription démarre-t-elle ?
3. **Latence et batterie** sur un téléphone d'entrée de gamme.
4. **Téléphone verrouillé** : la webview peut être suspendue par le système ; tester si les sous-titres continuent écran éteint.

## Ponctuation

Vosk renvoie du texte brut. `src/ponctuation.ts` le ponctue localement, sans délai :
- point à chaque fin de phrase (pause dans la voix) ;
- virgule sur les pauses courtes, avant « mais », « donc »…, après « bonjour », « alors »… ;
- « ? » pour les questions détectées par les mots (« est-ce que », « pourquoi », « avez-vous »…) ;
- majuscule en début de phrase, espace insécable avant « ? » en français, « ¿ » en espagnol.

Une question posée uniquement par l'intonation (« Tu viens ? ») sera ponctuée d'un point.

## Limites connues

- Les modèles « small » de Vosk sont moins précis que la transcription intégrée d'Even, surtout dans le bruit.
- Pas de barre de progression pendant le téléchargement (Vosk ne la fournit pas).
- Une seule langue chargée à la fois.

## Fichiers

- `src/main.ts` — logique de l'app (événements lunettes, écran téléphone)
- `src/transcription.ts` — moteur Vosk local, conversion de l'audio des G2
- `src/lunettes.ts` — affichage des sous-titres (défilement, limite de caractères)
- `src/langues.ts` — liste des langues, détection et suppression des packs installés
- `app.json` — manifeste Even Hub (permissions micro des lunettes + réseau pour le téléchargement)
