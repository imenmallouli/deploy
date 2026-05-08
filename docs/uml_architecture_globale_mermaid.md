# Diagramme UML - Architecture globale

```mermaid
flowchart LR
    V[Voiture]
    D[Dongle AutoPi / OBD]
    AC[(AutoPi Cloud)]

    subgraph PLATFORME[Plateforme Auto Diagnostic]
        BR[Service de recuperation\ndes donnees AutoPi\nBridge / MQTT Gateway]
        MQ[(Broker MQTT\nMosquitto)]
        BK[Backend FastAPI\nAPI + logique metier]
        WS[Service WebSocket\nflux temps reel]
        MG[(MongoDB\ntelemetrie, DTC, donnees brutes)]
        PG[(PostgreSQL\nvehicules, flottes, alertes, utilisateurs)]
        IA[Module IA\nanalyse et recommandations]
        FW[Frontend Web\ndashboard et supervision]
    end

    V -->|Mesures vehicule| D
    D -->|Envoi des donnees| AC
    AC -->|Recuperation via API AutoPi| BR
    BR -->|Publication| MQ
    MQ -->|Ingestion des flux| BK
    BK -->|Stockage telemetrie et DTC| MG
    BK -->|Stockage metadonnees et alertes| PG
    BK -->|Analyse| IA
    IA -->|Recommandations et scoring| BK
    BK -->|REST| FW
    BK -->|Publication temps reel| WS
    WS -->|WebSocket| FW
```

## Legende des flux
- Acquisition: la voiture envoie ses informations au dongle AutoPi.
- AutoPi Cloud: les donnees transitent d'abord par le cloud AutoPi.
- Integration plateforme: un service recupere les donnees AutoPi puis les injecte dans la plateforme.
- Backend: il traite, stocke et expose les donnees.
- WebSocket: il diffuse les mises a jour en temps reel vers l'interface web.
- IA: elle analyse les donnees pour produire alertes, scoring et recommandations.
- Frontend: il affiche les resultats pour la supervision et la gestion de flotte.
