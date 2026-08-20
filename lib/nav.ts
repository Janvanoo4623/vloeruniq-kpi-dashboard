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
        href: '/cashflow',
        label: 'Cashflow',
        title: 'Cashflow',
        subtitle: 'Openstaande facturen en hoe snel er betaald wordt',
        Icon: Banknote,
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

/** De navigatie-ingang voor een pad ('/marge' → het Marge-item). */
export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === '/') return ALL_NAV_ITEMS.find((i) => i.href === '/');
  return ALL_NAV_ITEMS.find((i) => i.href !== '/' && pathname.startsWith(i.href));
}
