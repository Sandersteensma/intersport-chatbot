# ======================================
# Intersport Chatbot - Environment Variables
# ======================================
# Kopieer naar .env of zet in Netlify dashboard > Site settings > Environment variables

# --- Anthropic Claude API (verplicht) ---
# Maak een API key via https://console.anthropic.com
# Kosten: ~€0,003 per klantvraag met claude-haiku-4-5 (ong. €3 per 1000 gesprekken)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx

# Optioneel — ander Claude model. Default is claude-haiku-4-5-20251001 (goedkoop + snel).
# Voor complexere vragen kun je overwegen: claude-sonnet-4-6
# ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# --- Database (PostgreSQL) ---
# Gratis via Netlify Neon extension (wordt automatisch gezet)
# Of gratis tier op https://neon.tech
DATABASE_URL=postgres://user:password@host:5432/dbname?sslmode=require

# --- Magento 2 REST API ---
# Admin > System > Integrations > Add New Integration
# Geef toegang tot: Sales > Orders, Shipments, Catalog > Products
MAGENTO_BASE_URL=https://www.intersportroden.nl
MAGENTO_ACCESS_TOKEN=your_magento_access_token_here

# --- Admin login ---
# Wachtwoord voor het admin dashboard (kies zelf een sterk wachtwoord)
ADMIN_USERNAME=sander
ADMIN_PASSWORD=VeranderDitWachtwoord!
JWT_SECRET=genereer-een-lange-random-string-hier-minimaal-32-tekens

# --- Chatbot configuratie ---
BOT_NAME=Sporti
COMPANY_NAME=Intersport Roden
