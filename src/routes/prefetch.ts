import { loadEthDigestList } from '../data/ethNewsData';
import { loadEthDebateList } from '../data/ethDebatesData';
import { loadContentsIndex } from '../data/researchData';
import { loadRoadmapExplainers } from '../data/roadmapExplainers';
import { loadEthCalls } from '../data/ethCallsData';
import { loadEipList } from '../data/eipsData';
import { loadErcIndex, loadErcList } from '../data/ercsData';

// 메뉴에 마우스·손가락이 닿거나 키보드로 고르는 순간, 그 페이지의 코드와 데이터를 미리 받는다.
// import() 는 브라우저가 한 번만 받으므로 App.tsx 의 lazy() 와 같은 파일을 가리키면 된다.
// ponytail: 상단 메뉴 페이지만. 상세 페이지 링크까지 넓히려면 여기에 경로 패턴을 더한다
const ROUTES: Record<string, () => unknown[]> = {
  '/news': () => [import('../pages/News'), loadEthDigestList()],
  '/debates': () => [import('../pages/Debates'), loadEthDebateList()],
  '/contents': () => [import('../pages/Contents'), loadContentsIndex()],
  '/roadmap': () => [import('../pages/Roadmap'), loadEipList(), loadRoadmapExplainers()],
  '/forks': () => [import('../pages/Forks'), loadEthCalls()],
  '/calls': () => [import('../pages/Calls'), loadEthCalls()],
  '/eips': () => [import('../pages/Eips'), loadEipList(), loadEthCalls()],
  '/ercs': () => [import('../pages/Ercs'), loadEipList(), loadErcIndex(), loadErcList()],
  '/ef-mandate': () => [import('../pages/EfMandate')],
  '/events': () => [import('../pages/Events')],
  '/ecosystem': () => [import('../pages/Ecosystem')],
  '/team': () => [import('../pages/Team')],
  '/about': () => [import('../pages/About')],
};

const started = new Set<string>();

export function prefetchRoute(path: string): void {
  const run = ROUTES[path];
  if (!run || started.has(path)) return;
  started.add(path);
  // 미리 받기는 실패해도 그만이다. 실제로 열 때 다시 받고, 오류는 그 페이지가 보여 준다
  run().forEach((p) => Promise.resolve(p).catch(() => started.delete(path)));
}
