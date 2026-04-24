# UVPT · Veille Appels à Projets

Application web de veille IA sur les appels à projets pour l'association **Une Voie Pour Tous**.

---

## 🚀 Déploiement sur Vercel en 10 minutes

Aucune compétence technique requise. Tu vas juste cliquer et déposer un dossier.

### Étape 1 — Créer un compte Vercel (2 min)

1. Va sur **[vercel.com/signup](https://vercel.com/signup)**
2. Clique sur **"Continue with Email"** (ou GitHub/Google si tu as un compte)
3. Valide ton email
4. Quand Vercel te demande de créer une équipe : choisis **"Hobby"** (gratuit, largement suffisant)

### Étape 2 — Déposer le projet (3 min)

Deux méthodes — choisis celle qui te parle le plus.

**Méthode A · La plus simple (glisser-déposer le dossier)**

1. Sur le tableau de bord Vercel, clique sur **"Add New…"** → **"Project"**
2. Dans la page qui s'ouvre, cherche le bouton **"Import Third-Party Git Repository"** → descend plus bas, tu verras **"Deploy a template"** ou un lien pour uploader
3. Plus simple : utilise **Vercel CLI**. Ouvre un terminal sur ton Mac :
   ```bash
   npm install -g vercel
   cd /chemin/vers/uvpt-veille
   vercel
   ```
   Suis les instructions (connexion, nom du projet, confirmations). Vercel build + déploie automatiquement.

**Méthode B · Via GitHub (plus propre, recommandée pour la suite)**

1. Crée un compte sur **[github.com](https://github.com)** si tu n'en as pas
2. Crée un nouveau repository (public ou privé) nommé `uvpt-veille`
3. Uploade tous les fichiers du dossier `uvpt-veille` via l'interface web GitHub (bouton "Upload files")
4. Sur Vercel, clique **"Add New…"** → **"Project"** → **"Import Git Repository"** → choisis `uvpt-veille`
5. Vercel détecte automatiquement Vite. Clique **"Deploy"**.

### Étape 3 — Récupérer ton URL (1 min)

Après le déploiement (~30 secondes), Vercel te donne une URL du type :
```
https://uvpt-veille.vercel.app
```
C'est ton app. Ouvre-la, tu arrives sur l'écran de saisie de la clé API.

### Étape 4 — Ajouter à l'écran d'accueil de ton iPhone (1 min)

1. Ouvre **Safari** sur ton iPhone (pas Chrome, Safari uniquement pour cette fonction)
2. Va sur `https://uvpt-veille.vercel.app`
3. Appuie sur l'icône **Partager** (carré avec flèche vers le haut) en bas de l'écran
4. Descends et appuie sur **"Sur l'écran d'accueil"**
5. Nomme l'app **"UVPT Veille"** → **Ajouter**

✅ L'icône bleue avec "UV" en jaune apparaît sur ton écran d'accueil. Elle s'ouvre en plein écran comme une vraie app iOS.

---

## 🔑 Première utilisation

1. Ouvre l'app (depuis l'icône écran d'accueil ou l'URL Vercel)
2. Colle ta clé API Anthropic (récupérée sur [console.anthropic.com](https://console.anthropic.com) → API Keys)
3. Clique **"Activer la veille"**
4. Sur l'écran principal, clique **"Lancer la veille IA"**
5. Claude explore 8 thématiques en parallèle (~2-5 min) et remonte tous les AAP pertinents
6. Pour chaque AAP : clique **"Générer fiche conseil IA"** pour une analyse stratégique personnalisée UVPT

La clé API et tous tes AAP sont stockés **uniquement dans ton navigateur** (localStorage). Rien n'est envoyé ailleurs qu'à l'API Anthropic.

---

## 🔒 Sécurité

- **La clé API est stockée dans le localStorage de ton navigateur**. Elle ne transite qu'entre ton iPhone et `api.anthropic.com`.
- Si tu veux changer de clé : clique sur le bouton **"Clé API"** en haut à droite de l'app.
- Si tu utilises l'app sur plusieurs appareils, chaque appareil stocke ses propres données (pas de synchronisation).

---

## 💰 Coûts

- **Vercel** : 0 € (plan Hobby, largement suffisant)
- **API Anthropic** : tu paies tes appels API Claude. Une veille complète (8 vagues) coûte typiquement 0,50 à 2 € selon la quantité d'AAP retournés. Une fiche conseil : 0,05 à 0,15 €.

---

## 🛠 Développement local (optionnel)

Si tu veux modifier l'app :
```bash
npm install
npm run dev    # serveur local http://localhost:5173
npm run build  # génère /dist pour production
```

---

## 📁 Structure du projet

```
uvpt-veille/
├── index.html              ← page d'entrée + meta PWA iOS
├── package.json            ← dépendances
├── vite.config.js          ← config Vite
├── public/
│   ├── manifest.json       ← manifest PWA
│   ├── icon-192.png        ← icône écran d'accueil
│   └── icon-512.png
└── src/
    ├── main.jsx            ← point d'entrée React
    ├── App.jsx             ← app complète (écran clé API + veille)
    └── index.css           ← CSS global
```

---

**Association Une Voie Pour Tous** — Valorisation de l'enseignement professionnel
[unevoiepourtous.org](https://unevoiepourtous.org)
