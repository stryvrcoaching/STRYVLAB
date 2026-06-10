# 📥 Installation de la Police Systemia

## Étape 1 : Télécharger la Police

1. Va sur **https://www.dafont.com/systemia.font**
2. Clique sur **"Download"** (gratuit pour usage personnel)
3. Extrais le fichier ZIP

## Étape 2 : Installer les Fichiers

1. Ouvre le dossier extrait
2. Copie les fichiers `.ttf` ou `.otf` dans le dossier :
   ```
   public/fonts/
   ```

3. Les fichiers doivent s'appeler :
   - `Systemia-Regular.ttf` (ou `.otf`)
   - `Systemia-Bold.ttf` (ou `.otf`) - si disponible

## Étape 3 : Vérifier

Une fois les fichiers en place, redémarre le serveur de développement :
```bash
npm run dev
```

La police Systemia sera automatiquement appliquée sur tout le site.

---

## 📝 Notes

- **Usage personnel** : Gratuit
- **Usage commercial** : Nécessite une licence (voir le site de la police)
- **Formats supportés** : `.ttf` et `.otf`
- **Fallback** : Si la police n'est pas trouvée, le navigateur utilisera une police sans-serif par défaut

---

## ✅ Tailles Harmonieuses Configurées

Le CSS est déjà configuré avec des tailles harmonieuses :

- **H1** : `clamp(2.5rem, 5vw, 4rem)` - Grands titres
- **H2** : `clamp(2rem, 4vw, 3rem)` - Titres de section
- **H3** : `clamp(1.5rem, 3vw, 2rem)` - Sous-titres
- **H4** : `clamp(1.25rem, 2.5vw, 1.5rem)` - Titres mineurs
- **Corps de texte** : Taille par défaut du navigateur (généralement 16px)

Tous les textes utilisent maintenant Systemia avec des espacements de lettres optimisés.














