# Intersport Chatbot (AI editie)

AI chatbot widget voor Intersport Roden (Magento 2 webshop), aangedreven door Claude (Anthropic) met strikte FAQ + Magento grenzen.

## Features

- 💬 **Widget** — 1 JS-bestand dat via Magento admin wordt geladen (geen code-toegang nodig)
- 🤖 **Claude AI** — Natuurlijke Nederlandse gesprekken met strikte kennisbank-grenzen (geen fantasie)
- 📦 **Orderstatus & Track & Trace** — Claude roept Magento REST API aan via function calling
- 👟 **Productzoeker** — Live Magento zoekopdrachten, toont voorraad en prijzen
- 📚 **FAQ kennisbank** — Elke actieve FAQ wordt als context aan Claude meegegeven
- 📊 **Admin dashboard** — Statistieken, match-rate, gesprekken, feedback
- ❓ **Ongematchte vragen tab** — Bot verwijst door als hij het niet weet, jij voegt toe aan FAQ
- 💾 **Alles opgeslagen** — PostgreSQL bewaart alle gesprekken en tool-gebruik
- 💰 **Lage kosten** — ~€ 3 per 1000 klantvragen (Claude Haiku 4.5)

## Stack

- **Backend:** Netlify Functions (Node.js 20) — gratis tier
- **Database:** PostgreSQL via Neon — gratis tier
- **AI:** Claude (Anthropic) — claude-haiku-4-5 default, met function calling
- **Frontend:** Vanilla JS widget + admin dashboard
- **Magento:** REST API integration (alleen leesrechten)

## Installatie

Zie [INSTALLATIE.md](./INSTALLATIE.md) voor de volledige stap-voor-stap handleiding.

## Projectstructuur

```
intersport-chatbot/
├── netlify/functions/       # Backend API endpoints
│   ├── chat.js              # Rule-based chat engine
│   ├── feedback.js
│   ├── admin-login.js
│   ├── admin-conversations.js
│   ├── admin-unmatched.js   # Ongematchte vragen
│   ├── admin-faq.js         # FAQ CRUD
│   ├── admin-learn.js       # FAQ toevoegen vanuit gesprek
│   └── admin-stats.js
├── lib/
│   ├── db.js                # Postgres helpers
│   ├── magento.js           # Magento 2 REST API
│   ├── intent.js            # Intent detection + FAQ matching
│   └── auth.js              # JWT auth
├── db/
│   ├── schema.sql           # Database schema + starter FAQ's
│   └── init.js
├── public/
│   ├── index.html           # Test pagina
│   ├── widget/chatbot.js    # Het widget
│   └── admin/               # Admin dashboard
├── netlify.toml
├── package.json
└── .env.example
```

## Hoe werkt de AI engine?

De bot combineert Claude met strikte guardrails:

1. **System prompt met kennisbank** — Alle actieve FAQ's worden als context meegegeven, met regels: "antwoord uitsluitend hieruit of via tools"
2. **Tool calling (function use)** — Claude kan zelf `get_order_status`, `get_tracking` of `search_products` aanroepen op basis van de vraag
3. **Conversatiegeheugen** — Laatste ~12 berichten van de klant worden meegestuurd
4. **Strikte modus** — Geen persoonlijk productadvies, geen verzinsels; bij twijfel verwijst bot door naar winkel/e-mail
5. **Logging** — Elk gesprek en elke tool-call wordt opgeslagen in PostgreSQL voor analyse

## License

Private — alleen voor gebruik door Intersport Roden.
