import React from 'react';
import cartlyLogo from '@/assets/cartly-logo.png';
import loginBg from '@/assets/login-bg.png';

interface MarketingBackgroundProps {
  children: React.ReactNode;
}

export const MarketingBackground: React.FC<MarketingBackgroundProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#020817]">
      {/* Background Composition */}
      <div className="fixed inset-0 flex w-full h-full">
        {/* Left Side: Woman holding tablet (Asset placeholder) */}
        <div className="relative hidden lg:block w-1/2 h-full overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 hover:scale-105"
            style={{ 
              backgroundImage: `url(${loginBg})`,
              filter: 'contrast(1.1) brightness(0.7)'
            }}
          />
          {/* Cinematic Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#020817]/60 via-transparent to-[#020817]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020817]/20 via-transparent to-[#020817]/60" />
          
          {/* Neon Accents / Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-400/5 rounded-full blur-[100px]" />
        </div>

        {/* Right Side: UI Space (Gradient) */}
        <div className="w-full lg:w-1/2 h-full bg-gradient-to-br from-[#020817] via-[#020817] to-[#0f172a] relative">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          
          {/* Subtle Neon Accents for Right Side */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] hidden lg:block" />
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex w-full">
        {/* Left Side Content (Optional) */}
        <div className="hidden lg:flex w-1/2 items-end p-12 pb-20">
          <div className="max-w-md space-y-4 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>Marketing Automation</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight drop-shadow-2xl">
              Escale sua loja com <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Inteligência</span>
            </h1>
            <p className="text-lg text-slate-200 font-normal drop-shadow-lg bg-[#020817]/20 backdrop-blur-[2px] p-2 -ml-2 rounded-lg">
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
