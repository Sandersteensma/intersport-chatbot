// Intent detectie & FAQ matching (rule-based, geen AI)
// Alles is deterministisch en gratis

// ============ TEKST NORMALISATIE ============
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accenten weg
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ ORDERNUMMER DETECTIE ============
// Magento default increment_id: 9 cijfers starting with 1 (bv. 100001234)
// Flexibel: 7-12 cijfers
const ORDER_REGEX = /\b\d{7,12}\b/;
export function extractOrderNumber(text) {
  const m = text.match(ORDER_REGEX);
  return m ? m[0] : null;
}

// ============ INTENT KEYWORDS ============
// Volgorde = prioriteit (eerste match wint)
const INTENTS = [
  {
    name: 'track_trace',
    keywords: [
      'track', 'trace', 'track&trace', 'tracking', 'trackingnummer',
      'waar blijft', 'waar is mijn', 'waar is de', 'waar blijft mijn',
      'wanneer bezorgd', 'wanneer komt', 'wanneer krijg ik',
      'bezorging', 'pakket', 'pakketje', 'postnl', 'dhl',
      'volg', 'volgen'
    ]
  },
  {
    name: 'orderstatus',
    keywords: [
      'bestelling', 'bestelstatus', 'status bestelling', 'status order',
      'mijn order', 'mijn bestelling', 'ordernummer', 'order nummer',
      'betaald', 'verzonden', 'verstuurd'
    ]
  },
  {
    name: 'product_search',
    keywords: [
      'hebben jullie', 'verkopen jullie', 'zoek ik', 'zoek een',
      'op zoek', 'ik wil', 'kan ik', 'heb je',
      'voorraad', 'op voorraad', 'beschikbaar',
      'product', 'artikel'
    ],
    // Ook match op sport-product woorden:
    sportWords: [
      'schoen', 'schoenen', 'hardloop', 'voetbal', 'tennis',
      'bal', 'shirt', 'broek', 'jack', 'jas', 'sok', 'sokken',
      'fiets', 'bidon', 'racket', 'sporttas', 'rugtas',
      'nike', 'adidas', 'puma', 'asics', 'hummel', 'mizuno',
      'new balance', 'reebok', 'on running'
    ]
  },
  {
    name: 'greeting',
    keywords: ['hallo', 'hoi', 'hey', 'goedemorgen', 'goedemiddag', 'goedenavond', 'dag']
  },
  {
    name: 'thanks',
    keywords: ['bedankt', 'thanks', 'dank je', 'dank u', 'top', 'fijn', 'super']
  },
  {
    name: 'goodbye',
    keywords: ['doei', 'dag', 'tot ziens', 'fijne dag']
  }
];

export function detectIntent(text) {
  const norm = normalize(text);
  const words = norm.split(' ').filter(Boolean);

  // Ordernummer gevonden? Dan eerst bepalen of het orderstatus of tracking is
  const orderNum = extractOrderNumber(text);

  for (const intent of INTENTS) {
    // Check keywords
    const kwHit = intent.keywords.some(kw => norm.includes(kw));
    // Voor product_search: ook sportWords
    const sportHit = intent.sportWords?.some(sw => norm.includes(sw));

    if (kwHit || sportHit) {
      return {
        name: intent.name,
        orderNumber: orderNum,
        // Bij product search: haal zoekterm uit het bericht
        searchTerm: intent.name === 'product_search' ? extractSearchTerm(text, intent) : null,
      };
    }
  }

  // Alleen ordernummer zonder context: default orderstatus
  if (orderNum) {
    return { name: 'orderstatus', orderNumber: orderNum };
  }

  return { name: null, orderNumber: orderNum };
}

// Poging om zoekterm uit productvraag te halen
function extractSearchTerm(text, intent) {
  const norm = normalize(text);
  // Haal alle keyword triggers weg, hou de rest over
  const stripWords = new Set([
    ...intent.keywords.map(k => normalize(k)),
    'ik', 'jij', 'een', 'de', 'het', 'van', 'voor', 'met',
    'is', 'zijn', 'er', 'nog', 'ook', 'wel', 'graag',
    'welke', 'wat', 'die', 'dat', 'deze', 'zoek', 'heb',
    'hebben', 'hebt', 'kan', 'wil', 'mag'
  ]);
  const words = norm.split(' ')
    .filter(w => w.length > 1 && !stripWords.has(w));
  return words.join(' ').trim() || null;
}

// ============ FAQ MATCHING ============
// Score elke FAQ op keyword-overlap + prioriteit
export function matchFaq(text, faqs) {
  const norm = normalize(text);
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqs) {
    if (!faq.active) continue;
    const kws = faq.keywords || [];
    let score = 0;
    let hits = 0;

    for (const kw of kws) {
      const normKw = normalize(kw);
      if (!normKw) continue;
      if (norm.includes(normKw)) {
        hits++;
        // Langere keyword matches tellen zwaarder
        score += 1 + (normKw.length / 20);
      }
    }

    // Vraag-tekst zelf ook checken (fallback: woord overlap)
    const faqQuestionNorm = normalize(faq.question);
    const faqWords = faqQuestionNorm.split(' ').filter(w => w.length > 3);
    const msgWords = new Set(norm.split(' '));
    const wordOverlap = faqWords.filter(w => msgWords.has(w)).length;
    if (wordOverlap >= 2) score += wordOverlap * 0.5;

    // Prioriteit boost
    score += (faq.priority || 0) * 0.1;

    if (hits > 0 && score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  // Alleen matchen als score hoog genoeg is
  return bestScore >= 1 ? { faq: bestMatch, score: bestScore } : null;
}

// ============ STANDAARD ANTWOORDEN ============
export const CANNED_REPLIES = {
  greeting: 'Hoi! Leuk dat je er bent. Ik help je graag met vragen over bestellingen, retouren, producten en openingstijden. Waar kan ik je mee helpen?',
  thanks: 'Graag gedaan! Nog iets anders waar ik je mee kan helpen?',
  goodbye: 'Tot ziens! Fijne dag nog. 👋',
  ask_order_number: 'Om je bestelling op te zoeken heb ik je ordernummer nodig. Dat is een nummer van 9 cijfers dat begint met 100 (bv. 100001234). Je vindt het in je bevestigingsmail.',
  no_match: 'Ik weet het antwoord hier niet direct op. Stel je vraag eventueel anders, of neem contact op via 📧 info@intersportroden.nl of kom langs in de winkel in Roden. Voor vragen over een bestelling: geef je ordernummer door.',
};

// ============ RESPONSE FORMATTERS ============
export function formatOrderStatus(order) {
  if (!order) {
    return 'Ik kan deze bestelling niet vinden in ons systeem. Controleer het ordernummer of neem contact op met onze klantenservice.';
  }
  const statusLabels = {
    'pending': 'in behandeling',
    'processing': 'wordt verwerkt',
    'complete': 'voltooid',
    'closed': 'afgesloten',
    'canceled': 'geannuleerd',
    'holded': 'on hold',
    'pending_payment': 'wacht op betaling',
  };
  const statusNl = statusLabels[order.status] || order.status;
  const date = new Date(order.created_at).toLocaleDateString('nl-NL');
  let txt = `📦 Bestelling ${order.increment_id}\n`;
  txt += `Status: ${statusNl}\n`;
  txt += `Besteld op: ${date}\n`;
  txt += `Totaal: € ${Number(order.grand_total).toFixed(2)}\n`;
  txt += `Artikelen: ${order.items.length}`;
  if (order.items.length > 0 && order.items.length <= 5) {
    txt += '\n' + order.items.map(i => `• ${i.qty}x ${i.name}`).join('\n');
  }
  return txt;
}

export function formatTracking(tracking, orderNum) {
  if (!tracking) {
    return `Ik kan geen verzendinformatie vinden voor bestelling ${orderNum}. Mogelijk is het pakket nog niet verzonden. Controleer je bevestigingsmail voor updates.`;
  }
  if (!tracking.tracks || tracking.tracks.length === 0) {
    return `Bestelling ${orderNum} is nog niet verzonden (status: ${tracking.order_status}). Je ontvangt automatisch een e-mail zodra het pakket onderweg is.`;
  }
  let txt = `📬 Verzendinformatie voor ${orderNum}:\n\n`;
  for (const t of tracking.tracks) {
    txt += `Vervoerder: ${t.carrier}\n`;
    txt += `Tracking: ${t.track_number}\n`;
    if (t.carrier.toLowerCase().includes('postnl')) {
      txt += `Volg hier: https://jouw.postnl.nl/track-en-trace/${t.track_number}\n\n`;
    } else if (t.carrier.toLowerCase().includes('dhl')) {
      txt += `Volg hier: https://www.dhlparcel.nl/nl/consument/volg-en-traceer?tt=${t.track_number}\n\n`;
    } else {
      txt += '\n';
    }
  }
  return txt.trim();
}

export function formatProductResults(products, searchTerm) {
  if (!products || products.length === 0) {
    return `Helaas heb ik geen producten gevonden voor "${searchTerm}". Probeer andere zoektermen of bekijk ons volledige assortiment op de webshop.`;
  }
  let txt = `Ik vond ${products.length} product${products.length > 1 ? 'en' : ''} voor je:\n\n`;
  for (const p of products.slice(0, 5)) {
    txt += `• ${p.name}\n`;
    txt += `  € ${Number(p.price).toFixed(2)}`;
    if (p.in_stock === false) txt += ' — tijdelijk niet op voorraad';
    if (p.url_key) txt += `\n  ${p.url}`;
    txt += '\n\n';
  }
  return txt.trim();
}
