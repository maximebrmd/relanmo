import { fonts } from "@relanmo/design-system/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Provider } from "@/components/provider";
import "./global.css";

export const metadata: Metadata = {
  description: "Documentation du socle Relanmo.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3004"
  ),
  title: "Relanmo documentation",
};

export default function Layout({ children }: LayoutProps<"/">): ReactNode {
  return (
    <html className={fonts} lang="fr" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
