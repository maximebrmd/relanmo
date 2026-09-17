import Link from "next/link";
import type { ReactNode } from "react";

export default function HomePage(): ReactNode {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 text-center">
      <p className="font-medium text-fd-muted-foreground text-sm uppercase tracking-wide">
        Relanmo
      </p>
      <h1 className="font-bold text-3xl">La prospection avance. Vous aussi.</h1>
      <p className="mx-auto max-w-xl text-fd-muted-foreground">
        La documentation de la base produit Relanmo. Le socle P001 prépare les
        applications et leurs frontières partagées ; les flux de prospection,
        d&apos;authentification et d&apos;envoi restent à construire.
      </p>
      <p>
        Consultez{" "}
        <Link className="font-medium underline" href="/docs">
          la documentation
        </Link>{" "}
        pour découvrir le périmètre du socle.
      </p>
    </div>
  );
}
