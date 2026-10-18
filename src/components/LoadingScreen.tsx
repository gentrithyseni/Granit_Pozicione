type LoadingScreenProps = {
  title: string;
  subtitle: string;
};

export function LoadingScreen({ title, subtitle }: LoadingScreenProps) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="loading-ambient loading-ambient-one" aria-hidden="true" />
      <div className="loading-ambient loading-ambient-two" aria-hidden="true" />
      <section className="loading-card">
        <div className="loading-brand">
          <div className="loading-logo-stage">
            <span className="loading-ring" aria-hidden="true" />
            <img className="loading-logo" src="/icons/graniti-mark.svg" alt="" />
          </div>
          <div className="loading-brand-copy">
            <strong>MEGRANT ING</strong>
            <span>SISTEMI ADMINISTRATIV</span>
          </div>
        </div>
        <div className="loading-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="loading-progress" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="loading-footnote">Ju lutem prisni pak</span>
      </section>
    </main>
  );
}