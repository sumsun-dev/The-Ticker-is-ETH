import {
  Search,
  Landmark,
  ArrowLeftRight,
  Wallet,
  Cable,
  BarChart3,
  Code,
  Image,
  Layers2,
  Coins,
  CircleDollarSign,
  Shield,
  Server,
  BookOpen,
} from 'lucide-react';

/** ecosystem-tools.json의 categories[].icon 이름 → 아이콘 (홈 섹션과 /ecosystem 공용) */
export const ecosystemIconMap: Record<string, React.ReactNode> = {
  Search: <Search size={16} />,
  Landmark: <Landmark size={16} />,
  ArrowLeftRight: <ArrowLeftRight size={16} />,
  Wallet: <Wallet size={16} />,
  Cable: <Cable size={16} />,
  BarChart3: <BarChart3 size={16} />,
  Code: <Code size={16} />,
  Image: <Image size={16} />,
  Layers2: <Layers2 size={16} />,
  Coins: <Coins size={16} />,
  CircleDollarSign: <CircleDollarSign size={16} />,
  Shield: <Shield size={16} />,
  Server: <Server size={16} />,
  BookOpen: <BookOpen size={16} />,
};
