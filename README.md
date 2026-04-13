# 🤖 Discord Moderation Bot

Bot Discord complet pour la modération d’un serveur avec :

* Reaction role sécurisé
* Anti-spam intelligent (flood + copier/coller)
* Système de blocage utilisateur
* Mode crise (lockdown complet avec restauration)
* Logs
* Commandes staff sécurisées
* Watchdog (auto-restart)

---

## 🚀 Fonctionnalités

### 🎯 Accès via réaction

* Donne un rôle si bon emoji
* Bloque l’utilisateur si mauvais emoji
* Empêche toute tentative après erreur

---

### 🛡️ Anti-spam avancé

* Détection flood rapide
* Détection copier/coller
* Suppression des messages dans tous les salons
* Attribution du rôle **Spammeur**

---

### 🔒 Mode crise (Lockdown)

* `!lockdown` → bloque tout le serveur sauf staff
* `!unlockdown` → restaure toutes les permissions
* Sauvegarde complète des permissions

---

### 🔓 Commandes staff

* `!unlock @user` → débloque un utilisateur

---

### 📝 Logs

* Logs automatiques des actions importantes
* Format clair (embed)

---

### ⏰ Automatisation

* Commande automatique `!sub` programmée

---

### 🛡️ Sécurité

* Aucun fonctionnement en MP
* Commandes limitées à un salon spécifique
* Utilisation des IDs (pas de noms)
* Watchdog anti-freeze

---

## 📦 Installation

```bash
git clone https://github.com/ton-repo/bot-discord.git
cd bot-discord
npm install
```

---

## ⚙️ Configuration

Créer un fichier `.env` :

```env
TOKEN=TON_TOKEN

MESSAGE_ID=ID_MESSAGE
CHANNEL_CMD=ID_SALON_COMMANDE
CHANNEL_LOG=ID_SALON_LOG

ROLE_MEMBER=ID_ROLE_MEMBRE
ROLE_SANCTION=ID_ROLE_SANCTION
ROLE_SPAM=ID_ROLE_SPAM
ROLE_STAFF=ID_ROLE_MOD,ID_ROLE_ADMIN

EMOJI=👍

MAX_MESSAGES=6
INTERVAL=3000
DUPLICATE_THRESHOLD=3

EXEMPT_BOTS=
```

---

## ▶️ Lancement

```bash
npm start
```

---

## 🛠️ Recommandé (production)

Utiliser PM2 :

```bash
npm install -g pm2
pm2 start index.js --name discord-bot
pm2 save
pm2 startup
```

---

## 🔑 Permissions requises

Le bot doit avoir :

* Manage Roles
* Manage Channels
* Manage Messages
* Send Messages
* Read Messages
* Add Reactions

⚠️ Le rôle du bot doit être **au-dessus des rôles qu’il gère**

---

## 📌 Notes importantes

* Les IDs sont obligatoires (pas les noms)
* Le bot ne fonctionne pas en messages privés
* Le salon commande est obligatoire
* Le watchdog nécessite PM2 pour redémarrage automatique

---

## 📈 Améliorations possibles

* Système de warns
* Anti-raid automatique
* Logs avancés
* Base de données
* Dashboard web

---

## 🧠 Auteur

Projet réalisé pour un usage de modération Discord avancé.

---

## ⚖️ Licence

Libre d’utilisation et de modification.
