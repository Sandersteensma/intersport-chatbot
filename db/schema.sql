-- =====================================================
-- Intersport Chatbot - Database Schema (rule-based, no AI)
-- =====================================================

-- Gesprekssessies
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  page_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

-- Berichten (met intent-tracking)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  matched_intent TEXT,            -- 'orderstatus', 'faq_X', 'product_search', 'fallback', etc.
  matched_faq_id BIGINT,          -- welke FAQ is gebruikt (indien van toepassing)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(matched_intent, created_at DESC);

-- FAQ kennisbank met keywords voor matching
CREATE TABLE IF NOT EXISTS faq_entries (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[],                -- bv. ['retour', 'retourneren', 'terugsturen']
  category TEXT DEFAULT 'algemeen',
  active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  match_count INT DEFAULT 0,      -- hoe vaak is deze FAQ gebruikt (voor statistiek)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faq_active ON faq_entries(active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_faq_keywords ON faq_entries USING GIN (keywords);

-- Feedback (duim omhoog/omlaag)
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log van gebruikte tools/intents (voor analyse)
CREATE TABLE IF NOT EXISTS tool_usage_log (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input JSONB,
  output JSONB,
  success BOOLEAN,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tool_log_name ON tool_usage_log(tool_name, created_at DESC);

-- Starter FAQ's met keywords (Nederlandse sport-webshop context)
INSERT INTO faq_entries (question, answer, keywords, category, priority) VALUES
('Wat zijn de openingstijden?',
 'Onze winkel in Roden is geopend: maandag 13:00-18:00, dinsdag t/m donderdag 09:30-18:00, vrijdag 09:30-21:00, zaterdag 09:30-17:00. Zondag gesloten. De webshop is 24/7 beschikbaar.',
 ARRAY['openingstijd','openingstijden','open','geopend','wanneer','tijden','winkel open','uren'],
 'winkel', 10),

('Hoe kan ik retourneren?',
 'Je kunt artikelen binnen 30 dagen retourneren. Gebruik het retourformulier dat bij je pakket zit, of vraag een nieuw formulier aan. Stuur het pakket naar: Intersport Roden. Na ontvangst verwerken we de terugbetaling binnen 5 werkdagen. Meer info: https://www.intersportroden.nl/retourneren',
 ARRAY['retour','retourneren','terugsturen','terug sturen','retourbeleid','ruilen','omruilen','verkeerd besteld','past niet','verkeerde maat'],
 'retour', 10),

('Wat zijn de verzendkosten?',
 'Verzendkosten binnen Nederland bedragen € 4,95. Bij bestellingen boven € 50 verzenden wij gratis. Levering binnen 1-2 werkdagen via PostNL of DHL.',
 ARRAY['verzendkosten','verzending','bezorgkosten','verzendprijs','levering','bezorgen','gratis verzenden','verzendtijd','hoe lang','wanneer ontvang','leverdatum','leveringstijd'],
 'verzending', 9),

('Welke betaalmethoden accepteren jullie?',
 'Wij accepteren iDEAL, creditcard (Visa, Mastercard), PayPal, Bancontact, Apple Pay en achteraf betalen via Klarna.',
 ARRAY['betalen','betaalmethode','betaalmethoden','ideal','creditcard','paypal','klarna','achteraf betalen','apple pay','bancontact'],
 'betalen', 8),

('Hoe neem ik contact op?',
 'Je kunt ons bereiken via: 📞 telefoon tijdens winkeltijden, 📧 info@intersportroden.nl, of langskomen in de winkel in Roden. Voor specifieke vragen over je bestelling: geef je ordernummer door, dan kijk ik direct voor je.',
 ARRAY['contact','telefoon','bellen','email','e-mail','mailen','klantenservice','hulp','spreken','contactgegevens','adres','waar zitten jullie','waar gevestigd'],
 'contact', 8),

('Kan ik mijn bestelling wijzigen of annuleren?',
 'Als je bestelling nog niet is verzonden kunnen we hem vaak nog wijzigen of annuleren. Neem direct contact op met onze klantenservice en geef je ordernummer door.',
 ARRAY['wijzigen','annuleren','aanpassen','veranderen','verkeerd besteld','maat aanpassen','ander product','order wijzigen','order annuleren'],
 'orders', 7),

('Wordt er ook in België bezorgd?',
 'Ja, wij bezorgen ook in België. Verzendkosten naar België zijn € 9,95. Levering binnen 2-4 werkdagen.',
 ARRAY['belgië','belgie','buitenland','internationaal','bezorgen belgië','leveren belgië'],
 'verzending', 6),

('Hoe weet ik welke maat ik nodig heb?',
 'Bij elk product vind je een maattabel onderaan de productpagina. Bij twijfel kun je het best langskomen in onze winkel in Roden voor passervies, of beide maten bestellen en één retourneren (retour is gratis binnen Nederland).',
 ARRAY['maat','maten','maattabel','pasvorm','welke maat','grote','klein','valt groot','valt klein','size chart','hoe groot'],
 'producten', 7)
ON CONFLICT DO NOTHING;
