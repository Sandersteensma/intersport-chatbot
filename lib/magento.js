// Magento 2 REST API wrapper
// Werkt via een Integration Token (Admin > System > Integrations)

const BASE = () => (process.env.MAGENTO_BASE_URL || '').replace(/\/$/, '');
const TOKEN = () => process.env.MAGENTO_ACCESS_TOKEN;

async function magentoFetch(path, options = {}) {
  const url = `${BASE()}/rest/V1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Magento API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Order opzoeken op increment ID (ordernummer dat de klant ziet)
export async function getOrderByIncrementId(incrementId) {
  try {
    const searchQuery = `searchCriteria[filter_groups][0][filters][0][field]=increment_id` +
      `&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(incrementId)}` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;

    const result = await magentoFetch(`/orders?${searchQuery}`);
    if (!result.items || result.items.length === 0) {
      return null;
    }
    const o = result.items[0];
    return {
      increment_id: o.increment_id,
      status: o.status,
      state: o.state,
      created_at: o.created_at,
      updated_at: o.updated_at,
      grand_total: o.grand_total,
      currency: o.order_currency_code,
      customer_email: o.customer_email,
      customer_firstname: o.customer_firstname,
      items: (o.items || []).map(i => ({
        name: i.name,
        sku: i.sku,
        qty: i.qty_ordered,
        price: i.price,
      })),
      shipping_address: o.extension_attributes?.shipping_assignments?.[0]?.shipping?.address || null,
    };
  } catch (err) {
    console.error('getOrderByIncrementId error:', err.message);
    return null;
  }
}

// Track & trace info ophalen voor een order
export async function getShipmentTracking(incrementId) {
  try {
    const order = await getOrderByIncrementId(incrementId);
    if (!order) return null;

    // Shipments ophalen
    const searchQuery = `searchCriteria[filter_groups][0][filters][0][field]=order_id` +
      `&searchCriteria[filter_groups][0][filters][0][value]=${order.entity_id || ''}` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;

    // Fallback: haal shipments op basis van increment_id (met order info al binnen)
    const orderFull = await magentoFetch(
      `/orders?searchCriteria[filter_groups][0][filters][0][field]=increment_id` +
      `&searchCriteria[filter_groups][0][filters][0][value]=${encodeURIComponent(incrementId)}` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`
    );

    if (!orderFull.items?.[0]) return null;
    const orderId = orderFull.items[0].entity_id;

    const shipResult = await magentoFetch(
      `/shipments?searchCriteria[filter_groups][0][filters][0][field]=order_id` +
      `&searchCriteria[filter_groups][0][filters][0][value]=${orderId}` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`
    );

    const tracks = [];
    for (const s of (shipResult.items || [])) {
      for (const t of (s.tracks || [])) {
        tracks.push({
          carrier: t.title || t.carrier_code,
          track_number: t.track_number,
          created_at: s.created_at,
        });
      }
    }

    return {
      order_status: order.status,
      tracks,
    };
  } catch (err) {
    console.error('getShipmentTracking error:', err.message);
    return null;
  }
}

// Producten zoeken (naam/sku)
export async function searchProducts(searchTerm, limit = 5) {
  try {
    const q = encodeURIComponent(searchTerm);
    const url = `/products?` +
      `searchCriteria[filter_groups][0][filters][0][field]=name` +
      `&searchCriteria[filter_groups][0][filters][0][value]=%25${q}%25` +
      `&searchCriteria[filter_groups][0][filters][0][condition_type]=like` +
      `&searchCriteria[filter_groups][1][filters][0][field]=status` +
      `&searchCriteria[filter_groups][1][filters][0][value]=1` +
      `&searchCriteria[filter_groups][1][filters][0][condition_type]=eq` +
      `&searchCriteria[pageSize]=${limit}`;

    const result = await magentoFetch(url);
    return (result.items || []).map(p => ({
      sku: p.sku,
      name: p.name,
      price: p.price,
      url_key: p.custom_attributes?.find(a => a.attribute_code === 'url_key')?.value,
      short_description: p.custom_attributes?.find(a => a.attribute_code === 'short_description')?.value,
      in_stock: p.extension_attributes?.stock_item?.is_in_stock ?? null,
      qty: p.extension_attributes?.stock_item?.qty ?? null,
    }));
  } catch (err) {
    console.error('searchProducts error:', err.message);
    return [];
  }
}

// Product URL bouwen op basis van url_key
export function productUrl(urlKey) {
  if (!urlKey) return BASE();
  return `${BASE()}/${urlKey}.html`;
}
