/*
 * オフラインで動作させるための Service Worker。
 *
 * 本アプリは打刻を localStorage に保存しており、サーバーとの通信を行わない。
 * したがって、画面を構成するファイル（HTML・JS・CSS・アイコン）さえ手元にあれば
 * 通信できない場所でも打刻できる。それを実現するのがこのファイルである。
 *
 * `public/` に置いたファイルはビルド時に変換されないため、ここは TypeScript では
 * なく素の JavaScript で記述する。
 */

/*
 * 以下の 2 つの値は、ビルド後に scripts/generate-sw-precache.mjs が実際の値へ
 * 置き換える。JS と CSS のファイル名にはビルドごとに変わるハッシュが含まれるため、
 * ここに直接書くことができない。
 */

/** キャッシュの名前。内容が変わると別の名前になり、古いキャッシュは破棄される。 */
const CACHE_NAME = '__CACHE_NAME__'

/** インストール時に取得しておくファイル。 */
const PRECACHE_URLS = '__PRECACHE_URLS__'

/**
 * 先読みするファイルの一覧を返す。
 *
 * 置き換えが行われていない場合に備え、配列であることを確認してから使う。最低限
 * ページ本体さえあれば、残りは実際のアクセス時にキャッシュされる。
 *
 * @returns 取得対象の URL
 */
function precacheUrls() {
  return Array.isArray(PRECACHE_URLS) ? PRECACHE_URLS : ['./', './index.html']
}

/*
 * キャッシュを照合する際の指定。
 *
 * `ignoreVary` を有効にしないとオフラインで動作しない。多くの配信元は
 * `Vary: Origin` や `Vary: Accept-Encoding` を返すが、Cache API は既定でこの
 * ヘッダーを尊重し、保存時と取得時でリクエストヘッダーが一致しなければ「無し」と
 * 判定する。先読みは `cache.addAll` によるヘッダーの少ないリクエストで行われる
 * のに対し、`<script type="module">` の読み込みは CORS モードとなり `Origin` が
 * 付く。この差だけでキャッシュを取り出せなくなる。
 *
 * ここで配信するのは内容が固定された静的ファイルであり、リクエスト元によって
 * 中身が変わることはない。したがって照合時に Vary を無視して差し支えない。
 */
const MATCH_OPTIONS = { ignoreVary: true }

/**
 * レスポンスをキャッシュへ保存する。
 *
 * 失敗しても表示には影響しないため、エラーは握りつぶしてよい。ここで例外を投げると
 * fetch の応答自体が失われてしまう。
 *
 * @param {Request} request - 対象のリクエスト
 * @param {Response} response - 保存するレスポンス
 */
function putInCache(request, response) {
  if (!response.ok) {
    return
  }
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, response))
    .catch(() => undefined)
}

// インストール時に、アプリの動作に必要なファイルをすべて取得しておく。
//
// 実際にアクセスされたものだけをキャッシュする方式では不十分である。初回表示の
// 時点では Service Worker がまだ有効になっておらず、その時に読み込まれた JS と
// CSS は記録されない。結果として、オフラインにすると HTML だけが残り、アプリを
// 起動できなくなる。
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(precacheUrls()))
      .then(() => self.skipWaiting()),
  )
})

// 名前が変わった古いキャッシュを削除する。これを怠ると、更新後も古いファイルが
// 残り続けて容量を圧迫する。
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // GET 以外と外部への通信は扱わない。
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }

  // ページの読み込みはネットワークを優先する。更新をすぐ反映させたいためであり、
  // 通信できない場合にキャッシュした HTML へ切り替える。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response.clone())
          return response
        })
        .catch(() =>
          caches
            .match('./index.html', MATCH_OPTIONS)
            .then((cached) => cached ?? Response.error()),
        ),
    )
    return
  }

  // JS や CSS はファイル名にハッシュが付いており、内容が変われば別の URL になる。
  // そのためキャッシュを優先してよい。見つからない場合のみ取得しに行く。
  event.respondWith(
    caches.match(request, MATCH_OPTIONS).then((cached) => {
      if (cached !== undefined) {
        return cached
      }
      return fetch(request)
        .then((response) => {
          putInCache(request, response.clone())
          return response
        })
        .catch(() => Response.error())
    }),
  )
})
