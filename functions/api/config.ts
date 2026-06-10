export async function onRequestGet({ env }: any) {
  return new Response(JSON.stringify({
    requirePassword: !!env.SITE_PASSWORD,
    hasAgnesKey: !!env.AGNES_API_KEY,
    hasRanmengKey: !!env.RANMENG_API_KEY
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
