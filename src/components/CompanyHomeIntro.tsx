import { NavLink } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Droplets,
  Eye,
  Handshake,
  Landmark,
  Route,
  Search,
  ShieldCheck,
  Target,
} from 'lucide-react';

const services = [
  { icon: Building2, title: 'Ndërtim & Infrastrukturë Rrugore', text: 'Planifikim dhe realizim i punëve ndërtimore me fokus në kontroll, afate dhe cilësi.' },
  { icon: ClipboardCheck, title: 'Menaxhim i Paramasave', text: 'Strukturim i pozicioneve, Librit të Masave dhe dokumentacionit teknik në një rrjedhë të qartë.' },
  { icon: Droplets, title: 'Ujësjellës & Kanalizime Civile', text: 'Zgjidhje të koordinuara për rrjete civile dhe punë infrastrukturore të matshme.' },
  { icon: Calculator, title: 'Analizë Çmimesh & Pozicionesh', text: 'Kalkulim i kostove, krahasim historik dhe vendimmarrje e mbështetur në të dhëna.' },
];

const partners = [
  { icon: Landmark, title: 'Komuna', text: 'Autoritete komunale dhe projekte publike' },
  { icon: Route, title: 'Ministri & organizata', text: 'Institucione publike dhe organizata partnere' },
  { icon: Handshake, title: 'Partnerë privatë', text: 'Bashkëpunime profesionale dhe të qëndrueshme' },
];

export function CompanyHomeIntro() {
  return (
    <section className="company-home-intro" aria-label="Rreth GRANITI SH.P.K.">
      <div className="company-hero-panel">
        <div className="company-hero-glow company-hero-glow-one" aria-hidden="true" />
        <div className="company-hero-glow company-hero-glow-two" aria-hidden="true" />
        <div className="company-hero-content">
          <span className="company-kicker"><ShieldCheck size={15} /> MEGRANT ING SH.P.K. · Prishtinë - Kosovë</span>
          <h1>Ndërtojmë të Ardhmen me <em>Precizion</em> dhe Transparencë</h1>
          <p>MEGRANT ING SH.P.K –kompani që përdor këtë platformë për menaxhimin e projekteve ndërtimore, paramasave, çmimeve dhe dokumentacionit të Librave Ndërtimor.</p>
          <div className="company-hero-actions">
            <NavLink className="company-primary-action" to="/search"><Search size={17} /> Kërko Projektet <ArrowRight size={16} /></NavLink>
            <a className="company-secondary-action" href="#about-us"><Eye size={17} /> Rreth Nesh</a>
          </div>
        </div>
        <div className="company-hero-signal" aria-hidden="true">
          <div className="company-signal-grid"><span /><span /><span /><span /></div>
          <div className="company-signal-label"><span>Qasje e bazuar në të dhëna</span></div>
        </div>
      </div>

      <div className="company-kpi-grid">
        <div className="company-kpi-card"><Building2 size={19} /><strong>100+</strong><span>Projekte dhe kontrata të realizuara</span></div>
        <div className="company-kpi-card"><Target size={19} /><strong>10+ vjet</strong><span>Eksperiencë pune në ndërtim</span></div>
        <div className="company-kpi-card"><Calculator size={19} /><strong>Ekspertizë</strong><span>Paramasa, pozicione dhe Libër Ndërtimor</span></div>
        <div className="company-kpi-card"><Handshake size={19} /><strong>Partner</strong><span>Komuna, ministri dhe organizata</span></div>
      </div>

      <div id="about-us" className="company-about-grid">
        <div className="company-section-copy">
          <span className="company-kicker">01 · Misioni ynë</span>
          <h2>Ndërtim i qëndrueshëm. Vendime të qarta.</h2>
          <p>GRANITI SH.P.K. bashkon përvojën në ndërtim me disiplinën e të dhënave. Nga pozicioni i parë deri te buxheti përfundimtar, çdo hap dokumentohet, kontrollohet dhe bëhet i kuptueshëm.</p>
          <p>Platforma jonë digjitale ndihmon ekipet të kalkulojnë pozicione, të analizojnë çmime historike dhe të menaxhojnë Libra Ndërtimorë me më shumë transparencë.</p>
        </div>
        <div className="company-values-panel">
          <div><CheckCircle2 size={18} /><span><strong>Cilësi e matshme</strong>Kontroll teknik dhe financiar në çdo fazë.</span></div>
          <div><Database size={18} /><span><strong>Teknologji praktike</strong>Të dhënat kthehen në vendime të dobishme.</span></div>
          <div><BarChart3 size={18} /><span><strong>Transparencë</strong>Gjurmë e qartë nga paramasa te realizimi.</span></div>
        </div>
      </div>

      <div className="company-services-section">
        <div className="company-section-heading"><div><span className="company-kicker">02 · Fushëveprimtaria</span><h2>Shërbime që lëvizin projektin përpara</h2></div><span className="company-section-index">04 / 04</span></div>
        <div className="company-services-grid">
          {services.map(({ icon: Icon, title, text }) => <article className="company-service-card" key={title}><span className="company-service-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p><span className="company-service-arrow"><ArrowRight size={16} /></span></article>)}
        </div>
      </div>

      <div className="company-partners-section">
        <div><span className="company-kicker">03 · Besimi</span><h2>Partnerë institucionalë</h2><p className="company-muted">Bashkëpunimi ndërtohet mbi performancë, dokumentim dhe përgjegjësi profesionale.</p></div>
        <div className="company-partners-grid">{partners.map(({ icon: Icon, title, text }) => <div className="company-partner-item" key={title}><Icon size={19} /><span><strong>{title}</strong><small>{text}</small></span></div>)}</div>
      </div>

      <div className="company-cta-panel">
        <div><span className="company-kicker">Gati për hapin tjetër?</span><h2>Mbajeni projektin nën kontroll.</h2><p>Hyni në panelin e analitikës për të parë projektet, vlerat dhe dokumentacionin tuaj.</p></div>
        <NavLink className="company-primary-action" to="/data">Hap panelin <ArrowRight size={16} /></NavLink>
      </div>
    </section>
  );
}