// Quick test van de intent detectie + FAQ matching
import { detectIntent, matchFaq, extractOrderNumber, normalize } from './lib/intent.js';

const faqs = [
  {
    id: 1, question: 'Wat zijn de openingstijden?',
    keywords: ['openingstijd','open','geopend','wanneer','tijden'],
    priority: 10, active: true, category: 'winkel',
    answer: 'Ma 13:00-18:00, di-do 09:30-18:00, vr 09:30-21:00, za 09:30-17:00'
  },
  {
    id: 2, question: 'Hoe kan ik retourneren?',
    keywords: ['retour','retourneren','terugsturen','ruilen','past niet','verkeerde maat'],
    priority: 10, active: true, category: 'retour',
    answer: 'Binnen 30 dagen retour via het formulier.'
  },
  {
    id: 3, question: 'Wat zijn de verzendkosten?',
    keywords: ['verzendkosten','verzending','bezorgkosten','levering','bezorgen'],
    priority: 9, active: true, category: 'verzending',
    answer: '€4,95 binnen NL, gratis vanaf €50.'
  },
];

const tests = [
  ['Wanneer zijn jullie open?', 'faq:winkel'],
  ['hoe laat gaan jullie open', 'faq:winkel'],
  ['waar blijft mijn bestelling 100012345', 'track_trace'],
  ['Hoe kan ik dit retourneren? schoenen passen niet', 'faq:retour'],
  ['ik wil graag ruilen', 'faq:retour'],
  ['wat kost de verzending', 'faq:verzending'],
  ['status van mijn order 100089012', 'orderstatus'],
  ['100001234', 'orderstatus'],  // alleen ordernummer
  ['hebben jullie Nike hardloopschoenen maat 42', 'product_search'],
  ['ik zoek een voetbalshirt', 'product_search'],
  ['hallo', 'greeting'],
  ['bedankt voor de hulp', 'thanks'],
  ['weet jij wat het weer morgen doet', null],  // fallback verwacht
];

console.log('=== Testing intent detection + FAQ matching ===\n');
let passed = 0, failed = 0;

for (const [msg, expected] of tests) {
  const intent = detectIntent(msg);
  let result;

  // Spiegelt de volgorde van handleMessage() in netlify/functions/chat.js:
  // 1) track_trace, 2) orderstatus met nummer, 3) social,
  // 4) sterke FAQ-match (>=1.5), 5) orderstatus zonder nummer,
  // 6) product_search, 7) zwakke FAQ-match, 8) fallback
  if (intent.name === 'track_trace') {
    result = 'track_trace';
  } else if (intent.name === 'orderstatus' && intent.orderNumber) {
    result = 'orderstatus';
  } else if (intent.name === 'greeting' || intent.name === 'thanks' || intent.name === 'goodbye') {
    result = intent.name;
  } else {
    const faqMatch = matchFaq(msg, faqs);
    if (faqMatch && faqMatch.score >= 1.5) {
      result = `faq:${faqMatch.faq.category}`;
    } else if (intent.name === 'orderstatus') {
      result = 'orderstatus';
    } else if (intent.name === 'product_search') {
      result = 'product_search';
    } else if (faqMatch) {
      result = `faq:${faqMatch.faq.category}`;
    } else {
      result = null;
    }
  }

  const ok = result === expected;
  if (ok) passed++; else failed++;
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} "${msg}"`);
  console.log(`   expected: ${expected}, got: ${result}${intent.orderNumber ? ` (order=${intent.orderNumber})` : ''}${intent.searchTerm ? ` (zoekterm="${intent.searchTerm}")` : ''}`);
}

console.log(`\n=== ${passed}/${tests.length} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
