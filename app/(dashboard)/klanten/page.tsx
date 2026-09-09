import KlantenView from '@/components/pages/KlantenView';

/**
 * De klantanalyses hangen aan de gekozen periode en komen daarom uit
 * DashboardProvider, net als de rest van de periode-afhankelijke cijfers. Deze
 * pagina haalt zelf niets meer op: deed hij dat wel, dan rekende hij altijd over
 * álle facturen en bleef het scherm onveranderd bij het wisselen van periode.
 */
export default function KlantenPage() {
  return <KlantenView />;
}
