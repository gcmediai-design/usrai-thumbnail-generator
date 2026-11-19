// Vercel Serverless Function: POST /api/recommend
// 썸네일 생성기의 "문구로 조합 추천받기"를 Claude API로 중계합니다.
// API 키는 Vercel 환경 변수에만 두고, 브라우저에는 절대 노출하지 않습니다.
//
// 필요한 환경 변수 (Vercel → Project → Settings → Environment Variables)
//   ANTHROPIC_API_KEY  (필수) 회사 Anthropic API 키
//   ANTHROPIC_MODEL    (선택) 사용할 모델 ID. 비우면 아래 DEFAULT_MODEL 사용
//   ALLOWED_ORIGINS    (선택) 허용할 주소, 쉼표로 구분. 예: https://thumb.example.vercel.app

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MAX_PROMPT = 30000; // 문자 수 제한 (라이브러리 목록 포함 약 1만 자)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  // 다른 사이트에서 이 API를 몰래 쓰지 못하도록 출처 확인
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length) {
    const from = req.headers.origin || req.headers.referer || '';
    if (!allowed.some(a => from.startsWith(a))) return res.status(403).json({ code: 'forbidden_origin' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ code: 'missing_api_key' });

  const body = typeof req.body === 'string' ? safeJSON(req.body) : req.body;
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ code: 'bad_prompt' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        system: '요청한 JSON 형식으로만 답하세요. 설명 문장이나 코드 블록 표시 없이 JSON 객체 하나만 출력합니다.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (r.status === 429) return res.status(429).json({ code: 'rate_limited' });
    if (!r.ok) {
      const t = await r.text();
      console.error('anthropic error', r.status, t.slice(0, 500));
      return res.status(502).json({ code: 'upstream_' + r.status });
    }

    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const json = extractJSON(text);
    if (!json) return res.status(502).json({ code: 'bad_model_output' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(json);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 'server_error' });
  }
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }
function extractJSON(t) {
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  return safeJSON(t.slice(a, b + 1));
}
