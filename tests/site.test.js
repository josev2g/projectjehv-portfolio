import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs'; import { execSync } from 'node:child_process';

const html = readFileSync('index.html', 'utf8');

test('booking, chat and CV are wired', () => {
  assert.match(html, /calendly\.com\/josev2g-va\/discovery-call/);
  assert.match(html, /Y3s8I7JWsxKS_H4WL7TXz/);
  assert.match(html, /1mh_jPkik_sDRft2goUJd_zflDA9P03M4/);
});

test('no em or en dashes in page copy', () => {
  for (const f of ['index.html', 'work/index.html'].filter(existsSync))
    assert.doesNotMatch(readFileSync(f, 'utf8'), /[–—]/, f);
});

test('no client names anywhere in tracked files', () => {
  assert.ok(existsSync('tools/private-names.txt'), 'tools/private-names.txt is missing');
  const names = readFileSync('tools/private-names.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n')
    .filter(f => /\.(html|js|css|md|json|txt|py)$/.test(f) && f !== 'tools/private-names.txt');
  for (const f of files) {
    const t = readFileSync(f, 'utf8').toLowerCase();
    for (const n of names) assert.ok(!t.includes(n.toLowerCase()), `${n} found in ${f}`);
  }
});
