import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'

/**
 * 큰 JSON 을 빌드할 때 줄여서 내보낸다. 원본 파일은 그대로(자동 수집기가 계속 씀).
 * - `x.json?head=N`  : 배열 앞 N개 (홈의 최신 목록용)
 * - `eth-calls.json?lite` : 콜 기록에서 발언(topics[].positions·quote)·채팅을 뺀 판. 목록·EIP·포크 화면용, 상세는 원본
 * - `team-enrichment.json?avatars` : 기여자 이름만 (홈 아바타)
 * - `eth-debates.json?debates`·`eth-digests.json?digests` : 토론·뉴스 목록용 (상세는 원본)
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

// 홈의 팀 아바타용: 기여자 이름만 (활동 기록 제외)
export function sliceAvatars(data: { contributors: Array<{ name: string }> }) {
  return { ...data, contributors: data.contributors.map((c) => ({ name: c.name })) }
}

const DEBATE_DROP = new Set(['keyPoints', 'background', 'whyItMatters', 'sources', 'resolution'])

// 토론 목록·EIP/ERC/콜 상세용: 인물·제목·요약·상태만. 발언 기록(timeline)은 개수만 남기려고 빈 객체로 둔다
export function sliceDebates(data: { debates: Array<Record<string, unknown> & { positions: Array<Record<string, unknown>>; timeline: unknown[] }> }) {
  return {
    ...data,
    debates: data.debates.map((d) => ({
      ...Object.fromEntries(Object.entries(d).filter(([k]) => !DEBATE_DROP.has(k))),
      keyPoints: [],
      positions: d.positions.map((p) => ({ stance: p.stance, label: p.label, holders: p.holders, points: [] })),
      timeline: d.timeline.map(() => ({})),
    })),
  }
}

// 뉴스 첫 화면용: 최신호만 본문(sections), 지난 호는 표지 정보만. 지난 호를 고르면 원본을 받는다
export function sliceDigests(data: { digests: Array<Record<string, unknown>> }) {
  return { ...data, digests: data.digests.map((d, i) => (i === 0 ? d : { ...d, sections: [] })) }
}

export default function jsonSlice(): Plugin {
  const PREFIX = '\0json-slice:'
  return {
    name: 'json-slice',
    enforce: 'pre',
    async resolveId(source, importer) {
      const m = source.match(/^(.*\.json)\?(lite|list|avatars|debates|digests|head=\d+)$/)
      if (!m) return null
      const r = await this.resolve(m[1], importer, { skipSelf: true })
      // id 에 `.json?` 이 남으면 Vite 기본 JSON 플러그인이 결과를 다시 JSON 으로 읽으려 한다
      return r && `${PREFIX}${r.id.split('?')[0]}#${m[2]}.js`
    },
    async load(id) {
      const m = id.match(/^\0json-slice:(.*?\.json)[^#]*#(lite|list|avatars|debates|digests|head=\d+)\.js/)
      if (!m) return null
      const [, file, q] = m
      this.addWatchFile(file)
      const data = JSON.parse(await readFile(file, 'utf8'))
      const out = q === 'lite' ? sliceCalls(data) : q === 'list' ? sliceList(data) : q === 'avatars' ? sliceAvatars(data) : q === 'debates' ? sliceDebates(data) : q === 'digests' ? sliceDigests(data) : data.slice(0, Number(q.slice(5)))
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(out))})`
    },
  }
}
