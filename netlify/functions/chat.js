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
      'Zoek een bestelling op in Magento op basis van het ordernummer (meestal 10 cijfers, bv. 4000089005). ' +
      'Gebruik dit ALLEEN wanneer de klant naar de status van een specifieke bestelling vraagt en een ordernummer heeft gegeven.',
    input_schema: {
      type: 'object',
      properties: {
        order_number: {
          type: 'string',
          description: 'Het ordernummer dat de klant heeft gegeven, bv. 4000089005',
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
          track_url: t.track_url || null,
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
  const botName = process.env.BOT_NAME || 'Sporti';
  const company = process.env.COMPANY_NAME || 'Intersport Roden';

  const faqBlock = faqs.map((f, i) =>
    `[FAQ ${i + 1}] Vraag: ${f.question}\nAntwoord: ${f.answer}${f.category ? `\nCategorie: ${f.category}` : ''}`
  ).join('\n\n');

  return `Je bent ${botName}, de vriendelijke online assistent van ${company} — een sportwinkel in Roden, Drenthe.
Je bent behulpzaam, warm en enthousiast over sport. Je praat Nederlands, op een natuurlijke, persoonlijke manier — alsof je een collega bent die even helpt. Houd antwoorden kort (max 4-5 regels), tenzij de klant meer wil weten.

STIJL:
- Wees warm en menselijk, niet robotachtig. Gebruik af en toe een emoji (maar niet overdrijven).
- Spreek de klant aan met "je/jij". Wees behulpzaam en denk mee.
- Als iets gelukt is (bestelling gevonden, product gevonden), reageer enthousiast.
- Als iets niet lukt, wees eerlijk en bied altijd een alternatief (e-mail of winkel).
- Gebruik GEEN markdown — de widget toont plain text. Gewone zinnen.

WAT JE WEL MAG:
- Informatie geven uit de FAQ-kennisbank hieronder.
- Resultaten uit tools gebruiken (get_order_status, get_tracking, search_products).
- Algemene begroetingen, bedanken, en sociale praatjes.
- Bij tracking: geef ALTIJD de track_url mee als die beschikbaar is, zodat de klant direct kan klikken.

WAT JE NIET MAG:
- NOOIT producten, prijzen, voorraad, leverdata of tracking verzinnen. Alleen echte data uit tools.
- GEEN eigen productadvies of meningen over merken/modellen. Bij persoonlijke adviesvragen (bv. "welke hardloopschoen past bij mij?"): verwijs vriendelijk naar de winkel of e-mail. Je mag wél de productzoeker gebruiken zodat de klant zelf kan kijken.
- NOOIT klantnamen, e-mailadressen of andere persoonlijke gegevens aan de klant tonen (privacy).

ORDERNUMMERS:
Klanten hebben een ordernummer van meestal 10 cijfers (bv. 4000089005). Als ze dat niet bij de hand hebben, vraag er vriendelijk naar. Het staat in hun bevestigingsmail.

BIJ TWIJFEL:
Weet je het antwoord niet zeker? Verwijs dan vriendelijk door:
📧 info@intersportroden.nl — of kom gezellig langs in de winkel in Roden!

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
      reply: reply || 'Hmm, ik kon geen goed antwoord genereren. Probeer het anders te vragen of neem contact op via info@intersportroden.nl.',
      matchedIntent,
      matchedFaqId: null,
    };
  }

  return {
    reply: 'Het lukt me even niet om dit goed te beantwoorden. Neem gerust contact op met onze klantenservice via info@intersportroden.nl of kom langs in de winkel.',
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
