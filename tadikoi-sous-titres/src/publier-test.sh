#!/usr/bin/env bash
# Met en ligne une version de test de l'app, utilisable directement
# dans Chrome sur un téléphone (sans lunettes, sans laisser l'ordinateur allumé).
# Usage, depuis le dossier du projet :  bash src/publier-test.sh
set -e
cd "$(dirname "$0")/.."

npm run build
rm -rf app
cp -r dist app
git add app
git commit -m "Version de test sur telephone" || true
git push

echo
echo "C'est en ligne. Dans 2 à 3 minutes, ouvrez sur le téléphone (en 4G) :"
echo "https://tadikoi.github.io/tadikoi-sous-titres/tadikoi-sous-titres/app/"
