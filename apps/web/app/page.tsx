export default function MarketingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <p className="text-muted-foreground font-mono text-sm tracking-[0.2em] uppercase">
          Relanmo
        </p>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl">
            La prospection avance. Vous aussi.
          </h1>
          <p className="text-muted-foreground max-w-2xl text-xl">
            Un socle de développement pour une prospection freelance bornée,
            attentive et humaine dès qu’un prospect répond.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Relanmo n’est pas encore connecté à un compte ni à un fournisseur.
        </p>
      </div>
    </main>
  );
}
