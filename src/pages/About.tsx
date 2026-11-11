import React from 'react';
import AboutHero from '../components/about/AboutHero';
import OriginStory from '../components/about/OriginStory';
import ImpactNumbers from '../components/about/ImpactNumbers';
import CoreValues from '../components/about/CoreValues';
import TeamPreview from '../components/about/TeamPreview';
import CommunityProof from '../components/about/CommunityProof';
import PoeticCTA from '../components/about/PoeticCTA';
import usePageMeta from '../hooks/usePageMeta';
import { T } from '../utils/lang';

const About: React.FC = () => {
    usePageMeta({ title: 'About', description: T('ECK(Ethereum Collective Korea)의 미션과 비전', 'The mission and vision of ECK (Ethereum Collective Korea)') });
    return (
    <div className="min-h-screen bg-theme-bg">
        <AboutHero />
        <OriginStory />
        <ImpactNumbers />
        <CoreValues />
        <TeamPreview />
        <CommunityProof />
        <PoeticCTA />
    </div>
    );
};

export default About;
