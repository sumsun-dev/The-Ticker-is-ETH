import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'

/**
 * 큰 JSON 을 빌드할 때 줄여서 내보낸다. 원본 파일은 그대로(자동 수집기가 계속 씀).
 * - `x.json?head=N`  : 배열 앞 N개 (홈의 최신 목록용)
 * - `eth-calls.json?lite` : 콜 기록에서 발언(topics[].positions·quote)·채팅을 뺀 판. 목록·EIP·포크 화면용, 상세는 원본
 * - `eips.json?list`·`ercs.json?list` : 해설 본문을 빼고 목록·검색에 쓰는 필드만 (상세 화면은 원본)
 */
export function sliceCalls(data: { calls: Array<Record<string, unknown> & { topics: Array<Record<string, unknown>> }> }) {
  return {
    ...data,
    calls: data.calls.map((c) => ({
      ...c,
      chat: [],
      topics: c.topics.map((t) => ({ title: t.title, intro: t.intro, decision: t.decision, positions: [] })),
    })),
  }
}

const LIST_KEYS = ['number', 'titleKo', 'topic', 'summary', 'meta']

export function sliceList(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.map((r: Record<string, unknown>) => Object.fromEntries(LIST_KEYS.map((key) => [key, r[key]]))) : v,
    ]),
  )
}

export default function jsonSlice(): Plugin {
  const PREFIX = '\0json-slice:'
  return {
    name: 'json-slice',
    enforce: 'pre',
    async resolveId(source, importer) {
      const m = source.match(/^(.*\.json)\?(lite|list|head=\d+)$/)
      if (!m) return null
      const r = await this.resolve(m[1], importer, { skipSelf: true })
      // id 에 `.json?` 이 남으면 Vite 기본 JSON 플러그인이 결과를 다시 JSON 으로 읽으려 한다
      return r && `${PREFIX}${r.id.split('?')[0]}#${m[2]}.js`
    },
    async load(id) {
      const m = id.match(/^\0json-slice:(.*?\.json)[^#]*#(lite|list|head=\d+)\.js/)
      if (!m) return null
      const [, file, q] = m
      this.addWatchFile(file)
      const data = JSON.parse(await readFile(file, 'utf8'))
      const out = q === 'lite' ? sliceCalls(data) : q === 'list' ? sliceList(data) : data.slice(0, Number(q.slice(5)))
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(out))})`
    },
  }
}
