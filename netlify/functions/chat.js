// POST /api/chat - AI chatbot met Claude + Magento tool use + FAQ context
//
// Strikte modus: Claude mag ALLEEN antwoorden op basis van:
//  1) De meegegeven FAQ-kennisbank (system prompt)
//  2) Resultaten uit Magento tools (orderstatus, tracking, productzoeker)
//  3) Algemene sociale beleefdheid (groeten, bedanken)
// Bij alle andere vragen verwijst Claude door naar winkel/e-mail.

import Anthropic from '@anthropic-ai/sdk';
import {
  ensureSession, saveMessage, getActiveFaqs, getRecentMessages,
  logToolUsage,
} from '../../lib/db.js';
import {
  getOrderByIncrementId, getShipmentTracking, searchProducts, productUrl,
} from '../../lib/magento.js';
import { jsonResponse, handleOptions } from '../../lib/auth.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOOL_ROUNDTRIPS = 4;

// ============ TOOLS voor Claude ============
const TOOLS = [
  {
    name: 'get_order_status',
    description:
      'Zoek een bestelling op in Magento op basis van het ordernummer (9 cijfers, begint meestal met 100). ' +
      'Gebruik dit ALLEEN wanneer de klant naar de status van een specifieke bestelling vraagt en een ordernummer heeft gegeven.',
    input_schema: {
      type: 'object',
      properties: {
        order_number: {
          type: 'string',
          description: 'Het ordernummer dat de klant heeft gegeven, bv. 100001234',
        },
      },
      required: ['order_number'],
    },
  },
  {
    name: 'get_tracking',
    description:
      'Haal track & trace (verzending) informatie op voor een bestelling in Magento. ' +
      'Gebruik dit wanneer de klant vraagt "waar blijft mijn pakket", "tracking", "wanneer komt mijn bestelling aan" etc. — met ordernummer.',
    input_schema: {
      type: 'object',
      properties: {
        order_number: {
          type: 'string',
          description: 'Het ordernummer',
        },
      },
      required: ['order_number'],
    },
  },
  {
    name: 'search_products',
    description:
      'Zoek producten in de Magento webshop op naam, merk of type. ' +
      'Gebruik dit wanneer de klant vraagt of iets op voorraad is of wil weten of we iets verkopen. ' +
      'Geef ALLEEN concrete producten terug die teruggevonden worden — geen verzinsels.',
    input_schema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'De zoekterm, bv. "Nike hardloopschoen" of "voetbalshirt PSV"',
        },
        limit: {
          type: 'integer',
          description: 'Maximum aantal producten om terug te geven (1-8)',
          default: 5,
        },
      },
      required: ['search_term'],
    },
  },
];

// ============ Tool executor ============
async function runTool(name, input, sessionId) {
  const start = Date.now();
  try {
    if (name === 'get_order_status') {
      const order = await getOrderByIncrementId(input.order_number);
      await logToolUsage(sessionId, name, input, order, !!order, Date.now() - start);
      if (!order) return { found: false, order_number: input.order_number };
      return {
        found: true,
        order_number: order.increment_id,
        status: order.status,
        state: order.state,
        created_at: order.created_at,
        grand_total: `${Number(order.grand_total).toFixed(2)} ${order.currency || 'EUR'}`,
        customer_firstname: order.customer_firstname,
        items: order.items.map(i => ({ name: i.name, qty: i.qty, price: Number(i.price).toFixed(2) })),
      };
    }

    if (name === 'get_tracking') {
      const tracking = await getShipmentTracking(input.order_number);
      await logToolUsage(sessionId, name, input, tracking, !!tracking, Date.now() - start);
      if (!tracking) return { found: false, order_number: input.order_number };
      return {
        found: true,
        order_number: input.order_number,
        order_status: tracking.order_status,
        tracks: (tracking.tracks || []).map(t => ({
          carrier: t.carrier,
          track_number: t.track_number,
          track_url:
            t.carrier?.toLowerCase().includes('postnl')
              ? `https://jouw.postnl.nl/track-en-trace/${t.track_number}`
              : t.carrier?.toLowerCase().includes('dhl')
                ? `https://www.dhlparcel.nl/nl/consument/volg-en-traceer?tt=${t.track_number}`
                : null,
        })),
      };
    }

    if (name === 'search_products') {
      const lim = Math.max(1, Math.min(8, Number(input.limit) || 5));
      const products = await searchProducts(input.search_term, lim);
      const withUrls = products.map(p => ({
        name: p.name,
        sku: p.sku,
        price: `${Number(p.price).toFixed(2)} EUR`,
        in_stock: p.in_stock,
        url: productUrl(p.url_key),
      }));
      await logToolUsage(sessionId, name, input, { count: withUrls.length }, true, Date.now() - start);
      return { count: withUrls.length, products: withUrls };
    }

    return { error: `Onbekende tool: ${name}` };
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    await logToolUsage(sessionId, name, input, { error: err.message }, false, Date.now() - start);
    return { error: 'Tool error', detail: err.message };
  }
}

// ============ System prompt bouwen ============
function buildSystemPrompt(faqs) {
  const botName = process.env.BOT_NAME || 'Ilse';
  const company = process.env.COMPANY_NAME || 'sportenski';

  const faqBlock = faqs.map((f, i) =>
    `[FAQ ${i + 1}] Vraag: ${f.question}\nAntwoord: ${f.answer}${f.category ? `\nCategorie: ${f.category}` : ''}`
  ).join('\n\n');

  return `Je bent ${botName}, de online klantenservice van Sport & Ski (winkels in Roden én Heerenveen, webshop op sportenski.nl).

TOON & STIJL:
- Schrijf alsof een echte medewerker zit te typen. Tutoyeren ("je" en "jij", niet "u").
- Vriendelijk, informeel, warm — maar zonder overdrijven. Geen "super leuk!!" of "wauw".
- Korte zinnen. Gewone spreektaal. Af en toe een "hoi", "top", "geen probleem" of "komt goed".
- Max 4-5 regels per antwoord, tenzij er meer uitleg nodig is.
- Emoji mag heel spaarzaam (max 1 per bericht, en alleen als het past). Liever geen emoji dan een geforceerde.
- Geen opsommingslijsten met streepjes tenzij echt nodig — gewoon in zinnen antwoorden.
- Geen markdown (de widget toont plain text).

WAT JE WEL/NIET DOET:
1. Gebruik UITSLUITEND info uit:
   (a) De FAQ-kennisbank hieronder.
   (b) Resultaten van tools (get_order_status, get_tracking, search_products).
   Verzin NOOIT orders, prijzen, voorraad, leverdata of producten.
2. Focus ligt op online klanten: bestellingen, verzending, retour, producten in de webshop.
3. Geef GEEN persoonlijk productadvies op eigen houtje (welk merk/maat/model). Je mag wél met de productzoeker concrete producten laten zien die de klant zelf kan bekijken.
4. Voor orderstatus/tracking: vraag om een ordernummer als de klant dat nog niet heeft gegeven.
5. Als een tool geen resultaat geeft: zeg dat eerlijk, en bied een alternatief (bv. contact opnemen of zelf checken op de site).
6. RETOUR: Wil een klant iets retourneren? Verwijs vriendelijk door naar https://www.sportenski.nl/ruilen-retourneren/ — daar kan de klant met ordernummer + e-mailadres zelf een retour starten.
7. RETOURKOSTEN: De verzendkosten voor een retour zijn voor rekening van de klant zelf. Kiest de klant in plaats van terugbetaling voor een coupon code, dan krijgt hij/zij een kortingscode voor sportenski.nl waarmee een nieuwe bestelling geplaatst kan worden. Noem dit alleen als het relevant is (bv. als de klant vraagt wat retour kost of wat de mogelijkheden zijn).

FALLBACK BIJ WINKELVRAGEN:
Wij hebben twee winkels. Als iemand naar openingstijden, adres, voorraad in de winkel of persoonlijk advies in de winkel vraagt:
- Vraag welke winkel ze bedoelen: Roden of Heerenveen.
- Verwijs daarna door met de juiste info uit de FAQ, óf naar de winkelpagina:
  • Roden: https://www.sportenski.nl/winkels/roden
  • Heerenveen: https://www.sportenski.nl/winkels/heerenveen

ALGEMENE FALLBACK:
Weet je het antwoord niet uit FAQ of tools? Verwijs door naar:
📧 info@sportenski.nl, of naar de winkelpagina's hierboven.

KENNISBANK (FAQ's):
${faqBlock || '(nog geen FAQ\'s toegevoegd)'}
`;
}

// ============ Hoofd handler ============
async function chatWithClaude(userMessage, sessionId) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [faqs, history] = await Promise.all([
    getActiveFaqs(100),
    getRecentMessages(sessionId, 12),
  ]);

  const system = buildSystemPrompt(faqs);

  // Bouw conversatiegeschiedenis voor Claude.
  // We laten alleen user/assistant berichten toe en zorgen dat het laatste bericht de huidige user-input is.
  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  if (!messages.length
      || messages[messages.length - 1].role !== 'user'
      || messages[messages.length - 1].content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  let matchedIntent = 'ai';
  const toolCalls = [];

  for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      tools: TOOLS,
      messages,
    });

    // Registreer assistant turn (met eventuele tool_use) voor vervolgronde
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCalls.push(block.name);
          const result = await runTool(block.name, block.input, sessionId);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Klaar — verzamel tekst
    const textBlocks = response.content.filter(b => b.type === 'text');
    const reply = textBlocks.map(b => b.text).join('\n').trim();

    if (toolCalls.length > 0) {
      matchedIntent = `ai:${toolCalls.join('+')}`;
    }
    return {
      reply: reply || 'Hmm, ik kon geen goed antwoord genereren. Probeer het anders te vragen of neem contact op via info@sportenski.nl.',
      matchedIntent,
      matchedFaqId: null,
    };
  }

  return {
    reply: 'Het lukt me even niet om dit goed te beantwoorden. Neem gerust contact op met onze klantenservice via info@sportenski.nl.',
    matchedIntent: 'ai:tool_loop',
    matchedFaqId: null,
  };
}

// ============ Netlify handler ============
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonResponse(500, {
        error: 'ANTHROPIC_API_KEY ontbreekt. Zet deze in Netlify env vars.',
      });
    }

    const body = JSON.parse(event.body || '{}');
    const { message, visitor_id, page_url } = body;

    if (!message || typeof message !== 'string' || message.length > 2000) {
      return jsonResponse(400, { error: 'Ongeldig bericht' });
    }
    if (!visitor_id) {
      return jsonResponse(400, { error: 'visitor_id ontbreekt' });
    }

    const userAgent = event.headers?.['user-agent'];
    const sessionId = await ensureSession(visitor_id, page_url, userAgent);

    await saveMessage(sessionId, 'user', message, null, null);

    const { reply, matchedIntent, matchedFaqId } = await chatWithClaude(message, sessionId);

    const assistantMsgId = await saveMessage(sessionId, 'assistant', reply, matchedIntent, matchedFaqId);

    return jsonResponse(200, {
      reply,
      session_id: sessionId,
      message_id: assistantMsgId,
      matched_intent: matchedIntent,
    });

  } catch (err) {
    console.error('chat handler error:', err);
    return jsonResponse(500, {
      error: 'Er ging iets mis. Probeer het later opnieuw of neem contact op met onze klantenservice.',
    });
  }
};
