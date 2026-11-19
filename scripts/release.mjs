// 새 버전 배포 준비: version.json과 index.html의 버전·변경 내역을 함께 올립니다.
// 사용법:  npm run release -- 1.1.0 "바뀐 점 1" "바뀐 점 2"
// 그다음 git commit & push 하면 Vercel이 자동 배포하고,
// 생성기를 열어 둔 사용자에게 "새 버전이 배포됐어요" 알림이 뜹니다.
import fs from 'node:fs';

const [version, ...notes] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '') || !notes.length) {
  console.error('사용법: npm run release -- 1.1.0 "바뀐 점 1" "바뀐 점 2"');
  process.exit(1);
}

const vPath = new URL('../version.json', import.meta.url);
const hPath = new URL('../index.html', import.meta.url);
const v = JSON.parse(fs.readFileSync(vPath, 'utf8'));
const cmp = (a, b) => { a = a.split('.').map(Number); b = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
if (cmp(version, v.version) <= 0) { console.error(`현재 버전(${v.version})보다 높은 번호를 써 주세요.`); process.exit(1); }

const date = new Date().toISOString().slice(0, 10);
v.version = version; v.date = date;
v.history = [{ version, date, notes }, ...(v.history || [])];
fs.writeFileSync(vPath, JSON.stringify(v, null, 2) + '\n');

let html = fs.readFileSync(hPath, 'utf8');
const re = /var APP_VERSION='[^']*',CHANGELOG=[\s\S]*?,VKEY=/;
if (!re.test(html)) { console.error('index.html에서 버전 위치를 찾지 못했어요.'); process.exit(1); }
html = html.replace(re, `var APP_VERSION='${version}',CHANGELOG=${JSON.stringify(v.history)},VKEY=`);
fs.writeFileSync(hPath, html);
console.log(`v${version} 준비 완료 → git add . && git commit -m "release v${version}" && git push`);
