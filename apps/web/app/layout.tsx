import { DesignSystemProvider } from "@relanmo/design-system";
import { fonts } from "@relanmo/design-system/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./styles.css";

export const metadata: Metadata = {
  description:
    "Relanmo aide les freelances à avancer dans leur prospection avec une reprise en main humaine dès la première réponse.",
  title: "Relanmo — La prospection avance. Vous aussi.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html className={fonts} lang="fr" suppressHydrationWarning>
      <body>
        <DesignSystemProvider>{children}</DesignSystemProvider>
      </body>
    </html>
  );
}
