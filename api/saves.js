// Vercel Serverless Function: /api/saves
// 저장 목록을 "팀 공용"으로 Vercel Blob에 보관합니다. (여러 브라우저·기기에서 공유)
//
// 저장 구조 (항목 1개당 2개 파일)
//   saves/<id>.json   가벼운 메타 {id, at, tpl, title, thumb}  ← 목록에 쓰임(빠름)
//   saves/<id>.state  재편집용 전체 설정(사진 포함)            ← "불러와서 편집"할 때만 읽음
//
// 필요한 설정 (Vercel → Storage → Blob 스토어 생성 후 이 프로젝트에 Connect)
//   BLOB_READ_WRITE_TOKEN  (필수) Blob 스토어를 연결하면 자동으로 생깁니다.
//   ALLOWED_ORIGINS        (선택) 허용 주소, 쉼표로 구분. 예: https://thumb.example.vercel.app
//
// 주의: 공개(public) Blob이라 URL을 아는 사람은 열 수 있습니다.
//       민감한 고객 사진이 걱정되면 비공개 저장소(KV 등)로 바꿔야 합니다.

import { list, put, del } from '@vercel/blob';

const PREFIX = 'saves/';
const TPL_CASE = { B: 1, B2: 1 }; // 고객 사례 템플릿

export default async function handler(req, res) {
  // 다른 사이트에서 몰래 쓰지 못하도록 출처 확인
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length) {
    const from = req.headers.origin || req.headers.referer || '';
    if (from && !allowed.some(a => from.startsWith(a))) return res.status(403).json({ code: 'forbidden_origin' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(501).json({ code: 'storage_not_configured' });

  try {
    if (req.method === 'GET') {
      // ?state=<id> → 특정 항목의 전체 설정(재편집용)
      const sid = req.query && req.query.state;
      if (sid) {
        const url = await findUrl(PREFIX + safeId(sid) + '.state', token);
        if (!url) return res.status(404).json({ code: 'not_found' });
        const st = await (await fetch(url)).json();
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(st);
      }
      // 목록 (가벼운 메타만)
      const { blobs } = await list({ prefix: PREFIX, token, limit: 1000 });
      const metas = blobs.filter(b => b.pathname.endsWith('.json'));
      const items = await Promise.all(metas.map(async b => {
        try { return await (await fetch(b.url)).json(); } catch (e) { return null; }
      }));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(items.filter(Boolean).sort((a, b) => b.at - a.at));
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? safeJSON(req.body) : req.body;
      if (!body || !body.id) return res.status(400).json({ code: 'bad_body' });
      const id = safeId(body.id);
      const meta = { id: body.id, at: body.at || Date.now(), tpl: body.tpl || '', title: body.title || '', thumb: body.thumb || '' };
      const state = body.state || {};
      // 같은 id가 있으면 덮어쓰기(버전 차이에 안전하게 지우고 다시 씀)
      await delByPrefix(PREFIX + id + '.', token).catch(() => {});
      await put(PREFIX + id + '.json', JSON.stringify(meta), { access: 'public', token, contentType: 'application/json', addRandomSuffix: false });
      await put(PREFIX + id + '.state', JSON.stringify(state), { access: 'public', token, contentType: 'application/json', addRandomSuffix: false });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      if (req.query && req.query.id) {
        await delByPrefix(PREFIX + safeId(req.query.id) + '.', token);
        return res.status(200).json({ ok: true });
      }
      const { blobs } = await list({ prefix: PREFIX, token, limit: 1000 });
      const scope = req.query && req.query.scope;
      let targets = blobs;
      if (scope === 'case' || scope === 'col') {
        const metas = blobs.filter(b => b.pathname.endsWith('.json'));
        const ids = [];
        await Promise.all(metas.map(async b => {
          try { const m = await (await fetch(b.url)).json(); if ((scope === 'case') === !!TPL_CASE[m.tpl]) ids.push(idOf(b.pathname)); } catch (e) {}
        }));
        const idset = new Set(ids);
        targets = blobs.filter(b => idset.has(idOf(b.pathname)));
      }
      if (targets.length) await del(targets.map(b => b.url), { token });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ code: 'method_not_allowed' });
  } catch (e) {
    console.error('saves error', e);
    return res.status(500).json({ code: 'server_error' });
  }
}

async function findUrl(pathname, token) {
  const { blobs } = await list({ prefix: pathname, token, limit: 1 });
  const hit = blobs.find(b => b.pathname === pathname) || blobs[0];
  return hit ? hit.url : null;
}
async function delByPrefix(prefix, token) {
  const { blobs } = await list({ prefix, token, limit: 1000 });
  if (blobs.length) await del(blobs.map(b => b.url), { token });
}
function idOf(pathname) { return pathname.slice(PREFIX.length).replace(/\.(json|state)$/, ''); }
function safeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); }
function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }
