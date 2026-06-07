export async function onRequestPost({ request, env }: any) {
  try {
    const { type, items, user = 'default' } = await request.json();
    if (!Array.isArray(items) || !type) {
      return new Response(JSON.stringify({ error: "Missing type or items array" }), { status: 400 });
    }

    if (items.length > 0) {
      const stmts = items.map((item: any) => 
        env.DB.prepare(
          "INSERT OR IGNORE INTO history_items (id, type, user_id, timestamp, payload) VALUES (?, ?, ?, ?, ?)"
        ).bind(item.id, type, user, item.timestamp || Date.now(), JSON.stringify(item))
      );
      await env.DB.batch(stmts);
    }

    return new Response(JSON.stringify({ success: true, count: items.length }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
