import React from 'react';
import cartlyLogo from '@/assets/cartly-logo.png';
import loginBg from '@/assets/login-bg.webp';
import loginBgMobile from '@/assets/login-bg-mobile.webp';

interface MarketingBackgroundProps {
  children: React.ReactNode;
}

export const MarketingBackground: React.FC<MarketingBackgroundProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#0a0a1a]">
      {/* Mobile Background (only visible on mobile) */}
      <div className="lg:hidden fixed inset-0 w-full h-full bg-[#0a0a1a]">
        <img 
          src={loginBgMobile} 
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'contrast(1.1) brightness(0.95)' }}
          loading="eager"
          fetchPriority="high"
        />
        {/* Cinematic dark overlays for legibility on mobile */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/10 to-background/60" />
        <div className="absolute inset-0 bg-background/5" />
        {/* Neon glows */}
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/15 rounded-full blur-[100px]" />
      </div>

      {/* Desktop Background Composition */}
      <div className="fixed inset-0 hidden lg:flex w-full h-full">
        {/* Left Side: Main Desktop Image */}
        <div className="relative w-1/2 h-full overflow-hidden">
          <img 
            src={loginBg} 
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            style={{ filter: 'contrast(1.05) brightness(0.85)' }}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/80" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/40" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        </div>

        {/* Right Side: Mobile Image as Card Background on Desktop */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <img 
            src={loginBgMobile} 
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            style={{ filter: 'contrast(1.05) brightness(0.8)' }}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/30 via-background/10 to-background/40" />
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex w-full">
        {/* Left Side Content (Desktop only) */}
        <div className="hidden lg:flex w-1/2 items-end p-12 pb-20">
          <div className="max-w-md space-y-4 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span>Marketing Automation</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight drop-shadow-2xl">
              Escale sua loja com <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Inteligência</span>
            </h1>
            <p className="text-lg text-slate-200 font-normal drop-shadow-lg bg-background/20 backdrop-blur-[2px] p-2 -ml-2 rounded-lg">
              A plataforma completa para gerenciar, escalar e automatizar seu e-commerce do zero ao milhão.
            </p>
          </div>
        </div>

        {/* Right Side Content (UI) */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md animate-fade-in">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
