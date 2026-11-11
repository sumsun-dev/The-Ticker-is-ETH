/** ECK가 만들거나 함께한 지난 행사. 설명·장소 글은 i18n events.json 의 descriptions·locations 키 */
export interface PastEvent {
    id: string;
    year: number;
    date: string;
    title: string;
    descriptionKey: string;
    locationKey: string;
    link: string;
    linkKey: 'website' | 'archive';
    image?: string;
}

export const PAST_EVENTS: PastEvent[] = [
    {
        id: 'ek1-2026-04',
        year: 2026,
        date: '2026.04.16',
        title: 'Ethereum Korea One',
        descriptionKey: 'ethereumKoreaOne',
        locationKey: 'dsrv',
        link: 'https://ethereumkorea.io/events/2026-04-ethereum-korea-one',
        linkKey: 'website',
    },
    {
        id: 'ethcon2024',
        year: 2024,
        date: '2024.10.18 – 10.20',
        title: 'Ethcon Korea 2024',
        descriptionKey: 'ethcon2024',
        locationKey: 'seoul',
        link: 'https://2024.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2024.webp',
    },
    {
        id: 'ethcon2023',
        year: 2023,
        date: '2023.09.01 – 09.03',
        title: 'Ethcon Korea 2023',
        descriptionKey: 'ethcon2023',
        locationKey: 'platz2',
        link: 'https://2023.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2023.png',
    },
    {
        id: 'ethcon2020',
        year: 2020,
        date: '2020.12.19 – 12.20',
        title: 'Ethcon Korea 2020',
        descriptionKey: 'ethcon2020',
        locationKey: 'seoulOnline',
        link: 'https://2024.ethcon.kr/archives/',
        linkKey: 'archive',
    },
    {
        id: 'ethcon2019',
        year: 2019,
        date: '2019.05.27 – 05.28',
        title: 'Ethcon Korea 2019',
        descriptionKey: 'ethcon2019',
        locationKey: 'coex',
        link: 'https://genesis.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2019.jpg',
    },
];
