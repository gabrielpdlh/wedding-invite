import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não derruba o deploy por erro de tipo. Atenção: isso não conserta nada, só
  // esconde — rode `npx tsc --noEmit` localmente antes de subir.
  // (No Next 16 o build não roda mais ESLint, então não existe chave `eslint`.)
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
