import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * ビルド後の dist を走査し、Service Worker が先読みするファイルの一覧を埋め込む。
 *
 * JS と CSS のファイル名にはビルドごとに変わるハッシュが含まれるため、この一覧は
 * public/sw.js に直接書くことができない。ビルド後に生成して差し込む必要がある。
 *
 * 依存を増やさずに済ませるため、外部のプラグインは使わず Node の標準機能だけで
 * 実装している。
 */

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const SW_PATH = join(DIST_DIR, 'sw.js')

/** 先読みの対象外とするファイル。Service Worker 自身と、容量の大きい素材を除く。 */
const EXCLUDED = new Set(['sw.js', 'icon-512.png'])

/**
 * ディレクトリ配下のファイルを再帰的に列挙する。
 *
 * @param {string} dir - 走査するディレクトリ
 * @returns 絶対パスの配列
 */
function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

const files = listFiles(DIST_DIR)
  .map((full) => relative(DIST_DIR, full).split(sep).join(posix.sep))
  .filter((path) => !EXCLUDED.has(path))
  .sort()

// "./" はページ本体を指す。index.html とは別の URL として要求されるため、両方を
// キャッシュしておく必要がある。
const urls = ['./', ...files.map((path) => `./${path}`)]

// キャッシュ名を内容から導出する。ファイルが 1 つでも変われば名前が変わり、古い
// キャッシュは activate の処理で破棄される。日時を使わないのは、内容が同じなら
// 同じ名前になってほしいためである。
const digest = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12)

const source = readFileSync(SW_PATH, 'utf8')
const replaced = source
  .replace("'__CACHE_NAME__'", JSON.stringify(`timecard-${digest}`))
  .replace("'__PRECACHE_URLS__'", JSON.stringify(urls))

if (replaced === source) {
  throw new Error('sw.js に置き換え対象の目印が見つからなかった。public/sw.js を確認すること。')
}

writeFileSync(SW_PATH, replaced)
console.log(`sw.js: ${urls.length} 件を先読み対象に設定（cache: timecard-${digest}）`)
