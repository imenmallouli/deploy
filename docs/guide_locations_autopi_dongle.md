# Guide Implementation — Locations + Dongle GPS AutoPi

## 1) Objectif

Mettre en place un suivi cartographique avec 2 pointeurs:

- pointeur bleu: position utilisateur (navigateur)
- pointeur vert: position dongle/vehicule (AutoPi)

Quand le dongle n'est plus connecte au vehicule ou n'envoie plus de position:

- cacher le pointeur vert de la carte
- afficher une barre noire (overlay) avec la derniere position connue + date/heure de derniere synchro

## 2) UX attendue

### Etat A — Dongle connecte (donnees fraiches)

- carte affiche:
  - bleu = ma position
  - vert = position vehicule/dongle
- on centre la map sur les 2 points (fit bounds)
- panneau info dongle:
  - statut: Connecte
  - derniere synchro: il y a X sec/min
  - vitesse + coordonnees

### Etat B — Dongle offline (donnees non fraiches)

- pointeur vert retire de la carte
- la barre noire reste visible avec:
  - statut: Hors ligne
  - derniere position connue (lat/lng)
  - derniere synchro (timestamp)
- le pointeur bleu continue normalement

### Etat C — Aucun dongle lie au compte

- carte: seulement le pointeur bleu (si geolocalisation autorisee)
- panneau info: message "Aucun dongle associe"

## 3) Regle de fraicheur

Utiliser une fenetre de fraicheur fixe, par exemple 5 minutes.

Formule:

- fresh = now - lastSeen <= 5 minutes

Sources possibles pour lastSeen:

1. vehicle_positions.updated_at
2. vehicles.last_autopi_seen
3. vehicles.last_connection

## 4) Donnees backend necessaires

### Endpoints utilises

- GET /api/v1/vehicles
- GET /api/v1/geofences/vehicle-positions

### Contrat minimal vehicle positions

Chaque element retourne au moins:

- vehicle_id
- latitude
- longitude
- speed (optionnel)
- updated_at

### Contrat minimal vehicles

Chaque vehicule doit exposer:

- id
- dongle_id ou autopi_device_id ou autopi_unit_id
- last_autopi_seen / last_connection

## 5) Securite et separation des comptes

Regle obligatoire:

- un compte user ne doit jamais voir les positions/geofences/devices d'un autre compte

Implementation backend recommandee:

- geofences/documents Mongo stockent owner_user_id
- devices/documents Mongo stockent owner_user_id
- endpoints list/update/delete filtrent owner_user_id = current_user_id
- vehicle-positions filtre par liste de vehicules autorises du compte courant

## 6) Implementation frontend (Locations)

Logique ecran:

1. charger vehicles + vehicle-positions
2. calculer une ligne dongle par vehicule qui possede un identifiant dongle
3. determiner selectedDongle:
   - priorite au premier dongle connecte avec position
   - sinon dernier dongle avec position
4. afficher pointeur bleu si geolocalisation disponible
5. afficher pointeur vert uniquement si selectedDongle est connecte
6. si offline, retirer le vert et afficher barre noire avec derniere position

## 7) Barre noire (spec contenu)

Contenu minimum:

- Vehicule: marque + modele + plaque
- Statut: Connecte / Hors ligne
- Derniere synchro: date + heure locale
- Position: latitude, longitude
- Vitesse (si disponible)

Style UX:

- fond noir semi-opaque
- texte blanc
- statut en vert si connecte, orange/rouge si offline
- position fixe en bas gauche (ou droite), non intrusive

## 8) Flux AutoPi conseille (documentation)

Reference:

- AutoPi Docs — Locations / Tracking / MQTT returner

Pipeline recommande:

1. AutoPi lit GPS/OBD
2. AutoPi publie via MQTT
3. bridge backend consomme MQTT
4. backend met a jour vehicle_positions
5. frontend Locations lit vehicle_positions toutes les 10-15 secondes

## 9) Scenarios de test (checklist)

### Test 1 — Connected

- dongle envoie GPS toutes les 10-30 sec
- vert visible
- barre noire affiche statut Connecte

### Test 2 — Offline

- couper la source GPS/dongle
- apres seuil de fraicheur:
  - vert disparait
  - barre noire passe Hors ligne
  - derniere position reste visible

### Test 3 — Separation user/admin

- creer des geofences/devices/positions sur admin
- connecter user
- verifier qu'il ne voit pas les donnees admin

### Test 4 — Geolocalisation navigateur refusee

- refuser permission GPS navigateur
- aucun crash
- dongle vert fonctionne si disponible

## 10) Points deja presents dans le projet

Le projet contient deja la base de cette logique dans Locations:

- pointeur bleu geolocation navigateur
- pointeur vert dongle quand donnees fraiches
- retrait du vert quand offline
- selection du dongle le plus pertinent

Fichiers utiles:

- frontend-web/src/pages/LocationsPage.tsx
- backend/app/api/v1/ops.py
- backend/app/services/ops_service.py

## 11) Reste a finaliser si besoin

- uniformiser le wording de la barre noire (FR/EN)
- ajouter une icone connexion claire (online/offline)
- option: afficher "temps ecoule" (il y a 6 s, il y a 2 min)
- option: stocker un historique de positions (polyline) pour visualiser le trajet

---

Si tu veux, la prochaine etape est de transformer ce guide en spec technique courte (1 page) + une checklist QA executable pour l'equipe.