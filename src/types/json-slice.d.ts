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
declare module '*.json?debates' {
  const data: unknown
  export default data
}
declare module '*.json?digests' {
  const data: unknown
  export default data
}
// 영어판: 같은 조각에 영어 사전(src/data/en)을 입힌 것. full 은 줄이지 않은 원본
declare module '*.json?lite&en' {
  const data: unknown
  export default data
}
declare module '*.json?list&en' {
  const data: unknown
  export default data
}
declare module '*.json?debates&en' {
  const data: unknown
  export default data
}
declare module '*.json?digests&en' {
  const data: unknown
  export default data
}
declare module '*.json?full&en' {
  const data: unknown
  export default data
}
