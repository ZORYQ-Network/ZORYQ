export const ZORYQ_UI = {
  productName: 'ZORYQ',
  descriptor: 'BEYOND BLOCKCHAIN',

  // Core surfaces
  background: '#090A10',
  backgroundSoft: '#11121A',
  panel: '#121522',
  panelSecondary: '#191D2B',
  panelGlass: 'rgba(18,21,34,0.82)',
  border: 'rgba(104,91,199,0.30)',
  borderStrong: 'rgba(218,255,2,0.46)',

  // Typography
  text: '#F3F0EB',
  muted: '#A8A4B5',

  // ZORYQ signature palette
  lime: '#DAFF02',
  orange: '#FE572A',
  violet: '#685BC7',
  magenta: '#F30EBB',
  cyan: '#00B0FF',
  green: '#25D366',
  teal: '#128C7E',
  tealDark: '#075E54',
  cream: '#F3F0EB',
  black: '#201E1F',

  // Semantic aliases used by existing screens
  primary: '#685BC7',
  primaryBright: '#F30EBB',
  accent: '#DAFF02',
  accentBlue: '#00B0FF',
  success: '#25D366',
  warning: '#FFC107',
  danger: '#FE572A',

  // Tone-on-tone gradients
  gradientPrimary: ['#685BC7', '#F30EBB', '#FE572A'] as const,
  gradientElectric: ['#00B0FF', '#685BC7', '#F30EBB'] as const,
  gradientLime: ['#DAFF02', '#25D366'] as const,
  gradientWarm: ['#DAFF02', '#FE572A'] as const,

  radius: 18,
  radiusLarge: 26,
  glowSoft: 28,
  glowStrong: 52,
} as const;

export const ZORYQ_NAVIGATION = {
  primary: ['Home', 'Explorar', 'Criar', 'Atividade', 'Perfil'],
  product: ['Comunidades', 'Mensagens', 'Wallet', 'Swap'],
  feed: ['Para você', 'Seguindo', 'Salvos'],
  composer: ['Texto', 'Imagem', 'Token', 'Transação', 'dApp'],
} as const;
