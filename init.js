# Installatie — Intersport Roden Chatbot (AI editie)

Deze chatbot draait grotendeels gratis met een klein beetje betaalde AI:
- ✅ Netlify gratis tier (hosting + functions)
- ✅ Neon gratis tier (PostgreSQL database)
- 💳 **Claude API (Anthropic)** — ongeveer € 0,003 per klantvraag (≈ € 3 per 1000 gesprekken)
- ✅ Strikte modus: Claude mag alleen antwoorden op basis van FAQ + Magento data (geen verzinsels)
- ✅ Geen code-toegang tot Magento nodig

**Totale tijd eerste installatie:** ongeveer 30–45 minuten.

---

## Wat ga je doen?

1. Code uploaden naar GitHub
2. Netlify-account koppelen
3. PostgreSQL database aanmaken (Netlify Extension → Neon)
4. Magento Integration Token aanmaken
5. Claude (Anthropic) API key aanmaken
6. Environment variables invullen
7. Database initialiseren
8. Widget-script toevoegen in Magento admin
9. Admin dashboard gebruiken

---

## Stap 1 — Code naar GitHub

1. Maak een account op https://github.com (als je die nog niet hebt)
2. Klik **New repository** → naam `intersport-chatbot` → **Private** → **Create**
3. Upload alle bestanden uit de map `intersport-chatbot/` via **Add file → Upload files** (je kunt ze slepen)

*Je hoeft `node_modules` of `.env` niet te uploaden — die worden automatisch aangemaakt.*

---

## Stap 2 — Netlify site aanmaken

1. Ga naar https://app.netlify.com en log in met je GitHub-account
2. Klik **Add new site → Import an existing project**
3. Kies **Deploy with GitHub** → autoriseer → selecteer je `intersport-chatbot` repo
4. Build settings kloppen al (staat in `netlify.toml`)
5. Klik **Deploy** — duurt 1–2 minuten
6. Noteer je site-URL (bv. `https://joyful-sparrow-abc123.netlify.app`)

💡 *Tip:* Je kunt deze URL later aanpassen via **Site settings → Domain management** (bv. naar `chatbot.intersportroden.nl`).

---

## Stap 3 — Database aanmaken (gratis)

1. In je Netlify site: klik **Extensions** in het zijmenu
2. Zoek **Neon** en klik **Install**
3. Volg de stappen — er wordt een gratis PostgreSQL database aangemaakt en `DATABASE_URL` automatisch als env var gezet

*Alternatief zonder extension:* maak een account op https://neon.tech (gratis), maak een database, kopieer de connection string, voeg 'm handmatig toe in stap 5.

**Gratis tier Neon:** 0,5 GB opslag, genoeg voor honderdduizenden gesprekken.

---

## Stap 4 — Magento Integration Token

Dit is hoe de chatbot orderstatus / producten ophaalt.

1. Log in op Magento admin (`/admin`)
2. Ga naar **System → Extensions → Integrations**
3. Klik **Add New Integration**
4. Vul in:
   - **Name:** `Chatbot`
   - **Email:** jouw e-mail
   - **Current User Identity Verification:** jouw Magento-wachtwoord
5. Tab **API** → selecteer:
   - ✅ Sales → Operations → Orders (View)
   - ✅ Sales → Operations → Shipments
   - ✅ Catalog → Inventory → Products
6. **Save** → klik **Activate** → bevestig
7. Je ziet 4 tokens — kopieer alleen de **Access Token**

💡 *Deze token geeft alleen leestoegang, geen wijzigingen.*

---

## Stap 5 — Claude API key aanmaken

De chatbot gebruikt Claude (Anthropic) voor natuurlijke gesprekken in het Nederlands.

1. Ga naar https://console.anthropic.com en maak een account
2. Voeg een betaalmethode toe bij **Settings → Billing** (betalen gaat per gebruik)
3. Zet een **monthly spending limit** (bv. € 20) als veiligheid — zo kun je nooit onverwacht veel uitgeven
4. Ga naar **API Keys** → **Create Key** → geef het een naam (bv. `Chatbot Intersport`)
5. Kopieer de key die begint met `sk-ant-api03-...` (deze zie je slechts één keer!)
6. Bewaar 'm veilig — hij gaat zo in stap 6

**Kosten per klantvraag:** gemiddeld € 0,002 – € 0,005 met het standaardmodel `claude-haiku-4-5`.
Voor een webshop met ~1000 klantvragen per maand = ongeveer **€ 3 per maand**.

💡 *Tip:* Je kunt in Anthropic console per dag zien hoeveel je hebt verbruikt.

---

## Stap 6 — Environment variables

In Netlify: **Site settings → Environment variables → Add a variable**

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | *(Claude key uit stap 5, begint met `sk-ant-api03-`)* |
| `MAGENTO_BASE_URL` | `https://www.intersportroden.nl` |
| `MAGENTO_ACCESS_TOKEN` | *(Magento token uit stap 4)* |
| `ADMIN_USERNAME` | `sander` *(of iets anders)* |
| `ADMIN_PASSWORD` | *(sterk wachtwoord voor admin dashboard)* |
| `JWT_SECRET` | *(32+ random tekens, bv. via https://1password.com/password-generator)* |
| `BOT_NAME` | `Sporti` *(of andere naam)* |
| `COMPANY_NAME` | `Intersport Roden` |

*`DATABASE_URL` is al automatisch gezet in stap 3.*

Optioneel: `ANTHROPIC_MODEL` om een ander Claude-model te kiezen. Default = `claude-haiku-4-5-20251001` (goedkoop + snel). Voor complexe vragen kun je `claude-sonnet-4-6` proberen (5–10× duurder).

Na het toevoegen: **Deploys → Trigger deploy → Deploy site** om ze actief te maken.

---

## Stap 7 — Database initialiseren

**Optie A — Via Neon console (makkelijkst):**

1. Log in op https://console.neon.tech
2. Open je database → **SQL Editor**
3. Open `db/schema.sql` uit het project, kopieer de inhoud
4. Plak in de SQL editor → klik **Run**

Je hebt nu alle tabellen + 8 starter-FAQ's. ✅

**Optie B — Via Netlify CLI:**

1. Installeer Node.js: https://nodejs.org
2. `npm install -g netlify-cli`
3. `netlify login`
4. In projectmap: `netlify link` → kies je site
5. `npm install`
6. `netlify dev` → in nieuwe terminal: `node db/init.js`

---

## Stap 8 — Widget toevoegen in Magento

1. Log in op Magento admin
2. **Content → Design → Configuration**
3. Klik **Edit** bij je store view (meestal `Default Store View`)
4. Open **HTML Head**
5. In veld **Scripts and Style Sheets** plak deze regel (vervang de URL door je Netlify URL):

```html
<script src="https://JOUW-SITE.netlify.app/widget/chatbot.js" async
  data-color="#e30613"
  data-bot-name="Sporti"></script>
```

6. Klik **Save Configuration**
7. **System → Cache Management → Flush Magento Cache**

**Klaar!** Rechtsonder op je webshop verschijnt nu de chatbubble. 🎉

---

## Stap 9 — Admin dashboard gebruiken

Ga naar `https://JOUW-SITE.netlify.app/admin/` en log in met username/wachtwoord uit stap 5.

### 📊 Dashboard
- Aantal gesprekken, berichten, unieke bezoekers
- **Match-rate**: % vragen waar de bot antwoord op wist
- **Onbeantwoord**: aantal vragen waar hij géén antwoord op had
- Top-vragen, intent verdeling, top FAQ's

### 💬 Gesprekken
Alle gesprekken bekijken. Achter elk bot-antwoord zie je een intent-label (bv. `faq:retour`, `orderstatus`, `fallback`).

### ❓ Ongematchte vragen (🌟 belangrijk!)
Dit is de **sleutel tot een slimmere bot**. Hier staan alle vragen waar de bot geen antwoord op wist. Klik **"Beantwoorden"** → voeg een antwoord toe → dit wordt direct een nieuwe FAQ en de bot beantwoordt voortaan soortgelijke vragen.

### 📚 FAQ / Kennisbank
Handmatig vragen toevoegen. Belangrijk: vul **keywords** in (komma-gescheiden). Dit bepaalt wanneer de FAQ wordt gekozen.

Voorbeeld:
- Vraag: `Welke schoenen zijn goed voor trailrunning?`
- Antwoord: `Voor trailrunning adviseren we schoenen met extra grip zoals Salomon of Hoka. Kom gerust langs voor persoonlijk advies!`
- Keywords: `trailrunning, trail, bosloop, mountain, grip, offroad`

Hoe meer synoniemen in keywords, hoe beter de match.

---

## Hoe werkt de bot?

De bot combineert **Claude AI** met een **strikte kennisbank** en **Magento tools**:

**1. Strikte system prompt**
- Claude krijgt bij elk gesprek alle actieve FAQ's + regels: "gebruik ALLEEN deze info + de tools". Geen fantaseren.

**2. Magento tools (function calling)**
- `get_order_status` — Claude vraagt hier om wanneer klant een ordernummer noemt
- `get_tracking` — voor "waar blijft mijn pakket"
- `search_products` — voor "hebben jullie Nike maat 42?"
- Resultaten komen rechtstreeks uit Magento REST API, nooit verzonnen

**3. Conversatiegeheugen**
- De laatste ~12 berichten van deze klant worden meegestuurd, dus Claude onthoudt context binnen het gesprek

**4. Geen creatief productadvies**
- Bij persoonlijke adviesvragen ("welke schoen past bij mij?") verwijst de bot door naar de winkel of e-mail. Hij mag wel producten **tonen** via de productzoeker, maar geen voorkeuren uitspreken.

**5. Alles gelogd**
- Elk gesprek + elk tool-gebruik wordt opgeslagen in PostgreSQL. In het admin dashboard zie je wat de bot heeft gedaan.

**6. Fallback**
- Weet de bot iets niet zeker? Dan verwijst hij door naar klantenservice en komt de vraag terecht in "Ongematchte vragen" in het admin dashboard.

---

## Onderhoud & kosten

**Kosten per maand:**

| Onderdeel | Kosten |
|---|---|
| Netlify hosting + functions | € 0 (gratis tier, 125k calls/maand) |
| Neon PostgreSQL | € 0 (gratis tier, 0,5 GB) |
| Magento API | € 0 (je eigen API) |
| Claude API (Anthropic) | ~ € 3 per 1000 klantvragen met `claude-haiku-4-5` |

**Voorbeeldrekening:** 2000 klantvragen per maand ≈ € 6 / maand totaal.

Je kunt in Anthropic console een hard monthly limit instellen zodat het nooit boven een bedrag kan komen.

**Bot slimmer maken (wekelijks 10 min werk):**
1. Open admin dashboard → ❓ **Ongematchte vragen** tab
2. Bekijk de lijst → klik **Beantwoorden** bij elke zinnige vraag
3. Vul antwoord + paar keywords in → **Toevoegen aan FAQ**
4. Volgende keer beantwoordt de bot deze vraag direct

**Updates doorvoeren:**
- Widget stijl wijzigen: pas `public/widget/chatbot.js` aan, commit → Netlify deployt automatisch
- Intent regels aanpassen: pas `lib/intent.js` aan
- Nieuwe productcategorieën: voeg toe aan `sportWords` in `lib/intent.js`

---

## Problemen?

**"Chatbot opent niet op mijn site"**
- Check browser console (F12) op fouten
- Test eerst via `https://JOUW-SITE.netlify.app/` — daar is de widget al ingeladen
- Flush Magento cache

**"Bot geeft foutmelding"**
- Check Netlify **Functions → chat → Logs**
- Meest voorkomend: `ANTHROPIC_API_KEY` niet gezet, database niet geïnitialiseerd, of `MAGENTO_ACCESS_TOKEN` verkeerd

**"Bot gaat over budget"**
- Zet een monthly spending limit in https://console.anthropic.com → Settings → Billing
- Wissel naar `claude-haiku-4-5-20251001` (goedkoopste model) via `ANTHROPIC_MODEL` env var

**"Orderstatus werkt niet"**
- Check of Magento-integration op **Active** staat
- Test de API zelf: `curl -H "Authorization: Bearer JOUW_TOKEN" https://www.intersportroden.nl/rest/V1/orders?searchCriteria[pageSize]=1`

**"Admin login werkt niet"**
- Check of `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET` alle drie ingevuld zijn in Netlify
- Trigger een nieuwe deploy na toevoegen van env vars

**"Match-rate is laag"**
- Ga naar **Ongematchte vragen** en voeg FAQ's toe met veel keywords
- Hoe meer synoniemen, hoe hoger de match-rate

---

## Later terug naar volledig gratis (zonder AI)?

Mocht je later willen terugvallen op een regelgebaseerde engine (€ 0 kosten):
- De database, widget en admin dashboard hoeven niet te veranderen
- Alleen `netlify/functions/chat.js` wordt vervangen door de oude regelgebaseerde versie (via git history)
- Vraag het en ik help je met de overstap
