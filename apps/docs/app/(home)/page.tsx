import Link from "next/link";
import type { ReactNode } from "react";

export default function HomePage(): ReactNode {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 text-center">
      <p className="text-fd-muted-foreground text-sm font-medium tracking-wide uppercase">
        Relanmo
      </p>
      <h1 className="text-3xl font-bold">La prospection avance. Vous aussi.</h1>
      <p className="text-fd-muted-foreground mx-auto max-w-xl">
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
