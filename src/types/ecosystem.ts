export type EcosystemCategory =
  | 'explorer'
  | 'defi'
  | 'dex'
  | 'wallet'
  | 'bridge'
  | 'analytics'
  | 'dev-tools'
  | 'nft';

export interface EcosystemTool {
  id: string;
  name: string;
  descriptionKey: string;
  url: string;
  category: EcosystemCategory;
  highlight?: boolean;
}

export interface EcosystemCategoryInfo {
  id: EcosystemCategory;
  labelKey: string;
  icon: string;
}
