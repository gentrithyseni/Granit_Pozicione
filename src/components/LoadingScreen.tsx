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
        <div className="loading-logo-stage">
          <span className="loading-ring loading-ring-outer" aria-hidden="true" />
          <span className="loading-ring loading-ring-inner" aria-hidden="true" />
          <span className="loading-logo-halo" aria-hidden="true" />
          <img className="loading-logo" src="/icons/graniti-mark.svg" alt="Megrant ING" />
        </div>
        <div className="loading-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
          <span className="loading-dots" aria-hidden="true"><i /> <i /> <i /></span>
        </div>
        <div className="loading-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}