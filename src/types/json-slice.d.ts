// vite-json-slice.ts 가 만드는 줄인 JSON (모양은 원본과 같다, 호출하는 쪽에서 타입을 붙인다)
declare module '*.json?lite' {
  const data: unknown
  export default data
}
declare module '*.json?list' {
  const data: unknown
  export default data
}
declare module '*.json?head=3' {
  const data: unknown
  export default data
}
declare module '*.json?avatars' {
  const data: unknown
  export default data
}
