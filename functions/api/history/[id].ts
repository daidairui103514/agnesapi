export async function onRequestDelete({ request, env, params }: any) {
  try {
    const id = params.id;
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });

    await env.DB.prepare("DELETE FROM history_items WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
