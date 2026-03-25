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

export type TwitterCategory = 'official' | 'person';

export interface EcosystemTwitterAccount {
  id: string;
  name: string;
  handle: string;
  descriptionKey: string;
  url: string;
  category: TwitterCategory;
}
