#!/usr/bin/env bash
# Prépare les packs de langue au format attendu par l'app (.tar.gz).
# Les modèles officiels Vosk sont distribués en .zip : on les reconditionne.
# Usage : bash scripts/preparer-modeles.sh   → crée le dossier modeles/
set -euo pipefail

MODELES=(
  vosk-model-small-fr-0.22
  vosk-model-small-en-us-0.15
  vosk-model-small-es-0.42
  vosk-model-small-de-0.15
  vosk-model-small-it-0.22
)

mkdir -p modeles tmp-modeles
cd tmp-modeles
for m in "${MODELES[@]}"; do
  echo "→ $m"
  [ -f "$m.zip" ] || curl -fL -o "$m.zip" "https://alphacephei.com/vosk/models/$m.zip"
  rm -rf "$m" && unzip -q "$m.zip"
  # Un seul dossier racine dans l'archive (l'app le retire à l'extraction).
  tar -czf "../modeles/$m.tar.gz" "$m"
done
cd .. && rm -rf tmp-modeles
ls -lh modeles
echo
echo "Hébergez le contenu de modeles/ en HTTPS avec l'en-tête Access-Control-Allow-Origin: *"
echo "puis renseignez l'adresse dans src/langues.ts et app.json."
