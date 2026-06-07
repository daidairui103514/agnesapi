export async function onRequestDelete({ request, env, params }: any) {
  try {
    const id = params.id;
    const url = new URL(request.url);
    const user = url.searchParams.get('user') || 'default';
    
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

    await env.DB.prepare("DELETE FROM history_items WHERE id = ? AND user_id = ?").bind(id, user).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
