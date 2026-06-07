export async function onRequestGet({ request, env }: any) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const user = url.searchParams.get('user') || 'default';
  
  if (!type) return new Response(JSON.stringify({ error: "Missing type" }), { status: 400 });

  try {
    const { results } = await env.DB.prepare(
      "SELECT payload FROM history_items WHERE type = ? AND user_id = ? ORDER BY timestamp DESC"
    ).bind(type, user).all();
    
    const parsedResults = results.map((row: any) => JSON.parse(row.payload));
    return new Response(JSON.stringify(parsedResults), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }: any) {
  try {
    const { type, item, user = 'default' } = await request.json();
    if (!type || !item || !item.id) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO history_items (id, type, user_id, timestamp, payload) VALUES (?, ?, ?, ?, ?)"
    ).bind(item.id, type, user, item.timestamp || Date.now(), JSON.stringify(item)).run();

    return new Response(JSON.stringify({ success: true, id: item.id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
