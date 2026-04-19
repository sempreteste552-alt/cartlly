// Logos SVG simplificados dos principais bancos brasileiros
// Renderizados em branco/contraste para usar sobre gradientes coloridos

interface LogoProps {
  className?: string;
}

export function NubankLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="22" letterSpacing="-1">nu</text>
      <circle cx="38" cy="15" r="4" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function ItauLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 80 30" className={className} fill="currentColor">
      <rect x="2" y="4" width="22" height="22" rx="3" fill="currentColor" />
      <text x="28" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">itaú</text>
    </svg>
  );
}

export function BBLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 60 30" className={className} fill="currentColor">
      <rect x="2" y="4" width="56" height="22" rx="2" fill="currentColor" />
      <text x="8" y="21" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#003087">BB</text>
      <text x="26" y="21" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#003087">BRASIL</text>
    </svg>
  );
}

export function BradescoLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" letterSpacing="-0.5">Bradesco</text>
    </svg>
  );
}

export function SantanderLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 110 30" className={className} fill="currentColor">
      <path d="M8 8 Q 14 2, 20 8 T 32 8" stroke="currentColor" strokeWidth="3" fill="none" />
      <text x="0" y="26" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="13">Santander</text>
    </svg>
  );
}

export function CaixaLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" letterSpacing="-0.5">CAIXA</text>
    </svg>
  );
}

export function InterLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 70 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20">inter</text>
    </svg>
  );
}

export function C6Logo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 60 30" className={className} fill="currentColor">
      <text x="0" y="24" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="22">C6</text>
      <text x="32" y="22" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="9">BANK</text>
    </svg>
  );
}

export function BTGLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 50 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">BTG</text>
    </svg>
  );
}

export function XPLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 40 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">XP</text>
    </svg>
  );
}

export function PicPayLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 80 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">PicPay</text>
    </svg>
  );
}

export function MercadoPagoLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 30 30" className={className} fill="currentColor">
      <circle cx="15" cy="15" r="12" fill="currentColor" />
      <path d="M8 15 Q 15 10, 22 15" stroke="#00b1ea" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function PagBankLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14">PagBank</text>
    </svg>
  );
}

export function SafraLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 70 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Safra</text>
    </svg>
  );
}

export function NeonLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 70 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">neon</text>
    </svg>
  );
}

export function ItiLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 52 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20">iti</text>
    </svg>
  );
}

export function NextLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 70 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">next</text>
    </svg>
  );
}

export function DigioLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 70 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">digio</text>
    </svg>
  );
}

export function WillLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 60 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">will</text>
    </svg>
  );
}

export function OriginalLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">original</text>
    </svg>
  );
}

export function PanLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 60 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">PAN</text>
    </svg>
  );
}

export function BMGLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 60 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">bmg</text>
    </svg>
  );
}

export function ModalLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 75 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">modal</text>
    </svg>
  );
}

export function DaycovalLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 95 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">daycoval</text>
    </svg>
  );
}

export function BVLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 45 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20">bv</text>
    </svg>
  );
}

export function SicoobLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Sicoob</text>
    </svg>
  );
}

export function SicrediLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 95 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Sicredi</text>
    </svg>
  );
}

export function BanrisulLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 95 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Banrisul</text>
    </svg>
  );
}

export function MercantilLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15">Mercantil</text>
    </svg>
  );
}

export function BanestesLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 95 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Banestes</text>
    </svg>
  );
}

export function RennerLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 75 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Renner</text>
    </svg>
  );
}

export function CarrefourLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 100 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Carrefour</text>
    </svg>
  );
}

export function MagaluLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 85 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">Magalu</text>
    </svg>
  );
}

export function AmazonLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">amazon</text>
    </svg>
  );
}

export function StoneLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 75 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18">stone</text>
    </svg>
  );
}

export function SumUpLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 80 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16">SumUp</text>
    </svg>
  );
}

// Bandeiras
export function VisaLogo({ className = "h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 80 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="900" fontSize="20" letterSpacing="1">VISA</text>
    </svg>
  );
}

export function MastercardLogo({ className = "h-6" }: LogoProps) {
  return (
    <svg viewBox="0 0 50 30" className={className}>
      <circle cx="18" cy="15" r="11" fill="#eb001b" />
      <circle cx="32" cy="15" r="11" fill="#f79e1b" opacity="0.9" />
      <path d="M25 7 a11 11 0 0 1 0 16 a11 11 0 0 1 0-16" fill="#ff5f00" />
    </svg>
  );
}

export function AmexLogo({ className = "h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 80 30" className={className} fill="currentColor">
      <text x="0" y="20" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11">AMERICAN</text>
      <text x="0" y="28" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11">EXPRESS</text>
    </svg>
  );
}

export function EloLogo({ className = "h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 50 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" fontStyle="italic">elo</text>
    </svg>
  );
}

export function HipercardLogo({ className = "h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 90 30" className={className} fill="currentColor">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14">Hipercard</text>
    </svg>
  );
}

export function GenericCardLogo({ className = "h-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 50 30" className={className} fill="currentColor">
      <rect x="2" y="6" width="46" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="2" y1="12" x2="48" y2="12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
