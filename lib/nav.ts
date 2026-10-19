// De navigatiekaart van de app. Eén bron voor de sidebar én voor de paginakoppen,
// zodat een route nooit ergens anders anders heet.
import {
  Banknote,
  FileText,
  Filter,
  LayoutDashboard,
  Percent,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
  AlertTriangle,
  SlidersHorizontal,
  CalendarRange,
  MapPin,
  Users2,
  TrendingDown,
  Megaphone,
  Scale,
  Wallet,
  ShoppingBag,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  title: string; // paginakop (mag langer zijn dan het navigatielabel)
  subtitle: string;
  Icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Dagelijks',
    items: [
      {
        href: '/',
        label: 'Overzicht',
        title: 'Overzicht',
        subtitle: 'De cijfers die er vandaag toe doen',
        Icon: LayoutDashboard,
      },
      {
        href: '/controleren',
        label: 'Controleren',
        title: 'Controleren',
        subtitle: 'Wat de app niet zelf kan bepalen — en dus aan jou vraagt',
        Icon: AlertTriangle,
      },
      {
        href: '/planning',
        label: 'Planning',
        title: 'Planning',
        subtitle: 'Wat er is ingepland en wat er nog uitgevoerd moet worden',
        Icon: CalendarRange,
      },
    ],
  },
  {
    label: 'Geld',
    items: [
      {
        href: '/marge',
        label: 'Marge',
        title: 'Marge',
        subtitle: 'Marge per week, per product en per m²',
        Icon: Percent,
      },
      {
        href: '/resultaat',
        label: 'Resultaat',
        title: 'Resultaat',
        subtitle: 'Wat er onderaan overblijft: gefactureerde omzet min de kosten uit Moneybird',
        Icon: Scale,
      },
      {
        href: '/cashflow',
        label: 'Cashflow',
        title: 'Cashflow',
        subtitle: 'Openstaande facturen en hoe snel er betaald wordt',
        Icon: Banknote,
      },
      {
        href: '/verloren',
        label: 'Verloren',
        title: 'Verloren omzet',
        subtitle: 'Wat er niet doorging, en wat daarvan nog te bellen is',
        Icon: TrendingDown,
      },
      {
        href: '/pijplijn',
        label: 'Pijplijn',
        title: 'Pijplijn',
        subtitle: 'Verwachte omzet uit offertes die nog open staan',
        Icon: Filter,
      },
    ],
  },
  {
    label: 'Analyse',
    items: [
      {
        href: '/offertes',
        label: 'Offertes',
        title: 'Offertes',
        subtitle: 'Alle offertes in de periode, met marge en dekking',
        Icon: FileText,
      },
      {
        href: '/leadbronnen',
        label: 'Leadbronnen',
        title: 'Leadbronnen',
        subtitle: 'Waar de omzet vandaan komt, en wat elke bron waard is',
        Icon: Users,
      },
      {
        href: '/marketing',
        label: 'Marketing',
        title: 'Marketing',
        subtitle: 'Wat advertenties kosten, wat ze opleveren, en wat er van de marge overblijft',
        Icon: Megaphone,
      },
      {
        href: '/klanten',
        label: 'Klanten',
        title: 'Klanten',
        subtitle: 'Wie je klanten zijn, hoe afhankelijk je van een paar bent, en wie je laat wachten',
        Icon: Users2,
      },
      {
        href: '/regio',
        label: 'Regio',
        title: 'Regio',
        subtitle: 'Waar je makkelijk wint en waar je goed verdient',
        Icon: MapPin,
      },
      {
        href: '/trends',
        label: 'Trends',
        title: 'Trends',
        subtitle: 'Hoe de cijfers zich over langere tijd bewegen',
        Icon: TrendingUp,
      },
    ],
  },
  {
    label: 'Beheer',
    items: [
      {
        href: '/uitzonderingen',
        label: 'Uitzonderingen',
        title: 'Uitzonderingen',
        subtitle: 'Handmatige correcties en uitgesloten offertes, met hun effect op de marge',
        Icon: SlidersHorizontal,
      },
      {
        href: '/instellingen',
        label: 'Instellingen',
        title: 'Instellingen',
        subtitle: 'Inkoopprijzen, kosten per m² en uitsluitingen',
        Icon: Settings,
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

// ── De zijbalk: 9 onderdelen in plaats van 15 pagina's (2026-10-19) ──────
//
// Pagina's die dezelfde vraag beantwoorden zijn samengevoegd tot één onderdeel
// met een pilschakelaar bovenaan (SubNav). De losse adressen blijven bestaan:
// links, bladwijzers en de export werken gewoon door. NAV hierboven blijft de
// bron voor de titel en uitleg per pagina.

export interface NavSection {
  label: string;
  Icon: LucideIcon;
  /** Eerste route is de standaard als je op het onderdeel klikt. */
  routes: { href: string; label: string }[];
  /** Korte uitleg onder de titel in de kopbalk. */
  subtitle: string;
}

export interface SidebarGroup {
  label: string;
  items: NavSection[];
}

export const SIDEBAR: SidebarGroup[] = [
  {
    label: 'Dagelijks',
    items: [
      { label: 'Overzicht', Icon: LayoutDashboard, routes: [{ href: '/', label: 'Overzicht' }], subtitle: 'De cijfers die er vandaag toe doen' },
      {
        label: 'Controleren',
        Icon: AlertTriangle,
        routes: [
          { href: '/controleren', label: 'Te doen' },
          { href: '/uitzonderingen', label: 'Uitzonderingen' },
        ],
        subtitle: 'Wat de app niet zelf kan bepalen, en de correcties die je al deed',
      },
      { label: 'Planning', Icon: CalendarRange, routes: [{ href: '/planning', label: 'Planning' }], subtitle: 'Wat er is ingepland en wat er nog uitgevoerd moet worden' },
    ],
  },
  {
    label: 'Geld',
    items: [
      {
        label: 'Verkoop',
        Icon: ShoppingBag,
        routes: [
          { href: '/pijplijn', label: 'Pijplijn' },
          { href: '/offertes', label: 'Offertes' },
          { href: '/verloren', label: 'Verloren' },
        ],
        subtitle: 'Van open offerte tot gewonnen of verloren',
      },
      {
        label: 'Financieel',
        Icon: Wallet,
        routes: [
          { href: '/resultaat', label: 'Resultaat' },
          { href: '/marge', label: 'Marge' },
          { href: '/cashflow', label: 'Cashflow' },
        ],
        subtitle: 'Wat er overblijft, wat je verdient per vloer, en wat er op de bank komt',
      },
    ],
  },
  {
    label: 'Analyse',
    items: [
      {
        label: 'Marketing',
        Icon: Megaphone,
        routes: [
          { href: '/marketing', label: 'Kanalen' },
          { href: '/leadbronnen', label: 'Leadbronnen' },
        ],
        subtitle: 'Wat advertenties kosten en waar de omzet vandaan komt',
      },
      {
        label: 'Klanten',
        Icon: Users2,
        routes: [
          { href: '/klanten', label: 'Klanten' },
          { href: '/regio', label: 'Regio' },
        ],
        subtitle: 'Wie je klanten zijn en waar ze wonen',
      },
      { label: 'Trends', Icon: TrendingUp, routes: [{ href: '/trends', label: 'Trends' }], subtitle: 'Hoe de cijfers zich over langere tijd bewegen' },
    ],
  },
];

export const SETTINGS_SECTION: NavSection = {
  label: 'Instellingen',
  Icon: Settings,
  routes: [{ href: '/instellingen', label: 'Instellingen' }],
  subtitle: 'Inkoopprijzen, kosten per m² en uitsluitingen',
};

const ALL_SECTIONS: NavSection[] = [...SIDEBAR.flatMap((g) => g.items), SETTINGS_SECTION];

const matches = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

/** Het onderdeel waar een pagina onder valt ('/marge' → Financieel). */
export function sectionFor(pathname: string): NavSection | undefined {
  return ALL_SECTIONS.find((s) => s.routes.some((r) => matches(pathname, r.href)));
}

export function isRouteActive(pathname: string, href: string): boolean {
  return matches(pathname, href);
}

/** De navigatie-ingang voor een pad ('/marge' → het Marge-item). */
export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === '/') return ALL_NAV_ITEMS.find((i) => i.href === '/');
  return ALL_NAV_ITEMS.find((i) => i.href !== '/' && pathname.startsWith(i.href));
}
