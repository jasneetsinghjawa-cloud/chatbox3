// Vercel serverless function: POST /api/chat
// Holds the Groq key (from the GROQ_API_KEY environment variable) and the system prompt,
// so neither is ever sent to the browser.

const RULES = [
  'You are Mira, a student on the third floor of a school during a made-up zombie outbreak.',
  'You run a walkie-talkie called Lockdown Line. The person writing to you is on the other end of the radio.',
  'You already opened the channel with a short greeting, so do not greet again.',
  'Be a genuinely helpful assistant for whatever they ask: homework, plans, coding, stories, advice.',
  'The survival setting is only flavor. Use a calm radio voice, an occasional "copy that" or "over", and small school details like tiffin boxes, unit tests and lockers.',
  'Keep replies under 120 words unless they ask for more. Use plain text only: no markdown, no asterisks, no bullet symbols. Short lines are fine.',
  'Reply in the language the person writes in. If they write Hinglish, reply in Hinglish.',
  'Keep it PG. No gore and no graphic violence. Do not mention real shows, characters or brands.',
  'If the person sounds genuinely distressed or asks about a real emergency or health problem, drop the act and answer plainly and kindly.',
].join(' ');

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_MESSAGES = 14;   // how many recent turns we accept
const MAX_CHARS = 4000;    // per message

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'missing_api_key' });
    return;
  }

  // Validate the input so the endpoint can't be used as a free general-purpose proxy.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const list = body && Array.isArray(body.messages) ? body.messages : null;
  if (!list || list.length === 0 || list.length > MAX_MESSAGES) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  const messages = [];
  for (const m of list) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      res.status(400).json({ error: 'bad_request' });
      return;
    }
    if (m.content.length > MAX_CHARS) {
      res.status(413).json({ error: 'too_large' });
      return;
    }
    messages.push({ role: m.role, content: m.content });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: RULES }, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
  } catch (e) {
    res.status(502).json({ error: 'upstream_unreachable' });
    return;
  }

  if (!upstream.ok) {
    // Pass 429 through so the page can say "too many requests"; hide other upstream details.
    // A bad or expired Groq key (401) is reported as 500, the same as a missing key.
    const status = upstream.status === 429 || upstream.status === 413 ? upstream.status : (upstream.status === 401 ? 500 : 502);
    res.status(status).json({ error: 'upstream_error' });
    return;
  }

  // Stream Groq's server-sent events straight through to the browser.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  const reader = upstream.body.getReader();
  req.on('close', () => { reader.cancel().catch(() => {}); });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) { /* client left or stream broke */ }
  res.end();
};
