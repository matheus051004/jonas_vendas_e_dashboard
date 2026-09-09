import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@jonas/db", "@jonas/shared"],
  // Barrel imports do MUI puxam o pacote inteiro no grafo de módulos;
  // isso reduz o que o bundler analisa em dev e no cold start das páginas.
  experimental: {
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-data-grid",
    ],
  },
  // Só em dev: o Next 15 (esp. com Turbopack) loga todo request e polui o terminal.
  // Mantém páginas/APIs “normais”; esconde assets, RSC interno e tráfego de alta frequência.
  logging: {
    incomingRequests: {
      ignore: [
        /\/_next\//,
        /\/favicon\.ico/,
        /\?_rsc=/,
        /\/api\/atendimentos\/stream/,
        /\/api\/branding/,
      ],
    },
  },
};

export default nextConfig;
