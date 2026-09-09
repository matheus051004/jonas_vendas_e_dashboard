"use client";

import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Stack,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import SellIcon from "@mui/icons-material/Sell";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import DescriptionIcon from "@mui/icons-material/Description";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo lead",
  INTERESSADO: "Interessado",
  PAROU_DE_RESPONDER: "Sumiu / Sem resposta",
  ACHOU_CARO: "Achou caro",
  FECHOU_VENDA: "Fechou venda",
  DESISTIU: "Desistiu",
};

const STAGE_COLORS: Record<string, string> = {
  NOVO_LEAD: "info.main",
  INTERESSADO: "warning.main",
  PAROU_DE_RESPONDER: "#9c27b0",
  ACHOU_CARO: "#ed6c02",
  FECHOU_VENDA: "success.main",
  DESISTIU: "grey.500",
};

const STAGE_BG: Record<string, string> = {
  NOVO_LEAD: "info.lighter",
  INTERESSADO: "warning.lighter",
  PAROU_DE_RESPONDER: "rgba(156, 39, 176, 0.12)",
  ACHOU_CARO: "rgba(237, 108, 2, 0.12)",
  FECHOU_VENDA: "success.lighter",
  DESISTIU: "grey.200",
};

const STAGE_ICONS: Record<string, React.ElementType> = {
  NOVO_LEAD: NewReleasesIcon,
  INTERESSADO: TrendingUpIcon,
  PAROU_DE_RESPONDER: HourglassEmptyIcon,
  ACHOU_CARO: MonetizationOnIcon,
  FECHOU_VENDA: SellIcon,
  DESISTIU: PersonOffIcon,
};

interface DashboardData {
  total: number;
  byStage: { stage: string; count: number }[];
  contracts: number;
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const countFor = (stage: string) => data?.byStage.find((s) => s.stage === stage)?.count ?? 0;
  const conversion = data?.total ? ((data.contracts / data.total) * 100).toFixed(1) : "0";

  const cards = [
    {
      label: "Total de leads",
      value: data?.total ?? "…",
      icon: PeopleAltIcon,
      color: "primary.main",
      bg: "primary.lighter",
    },
    ...Object.entries(STAGE_LABELS).map(([stage, label]) => ({
      label,
      value: data ? countFor(stage) : "…",
      icon: STAGE_ICONS[stage],
      color: STAGE_COLORS[stage],
      bg: STAGE_BG[stage],
    })),
    {
      label: "Contratos",
      value: data?.contracts ?? "…",
      icon: DescriptionIcon,
      color: "secondary.main",
      bg: "secondary.lighter",
    },
    {
      label: "Taxa de conversão",
      value: data ? `${conversion}%` : "…",
      icon: TrendingUpIcon,
      color: "success.main",
      bg: "success.lighter",
    },
  ];

  const funnelStages = ["NOVO_LEAD", "INTERESSADO", "FECHOU_VENDA"] as const;

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        {cards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: card.bg, color: card.color }}>
                    <card.icon />
                  </Avatar>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      {card.label}
                    </Typography>
                    <Typography variant="h4">{card.value}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box mt={4}>
        <Typography variant="h6" mb={2}>
          Funil de conversão
        </Typography>
        <Stack spacing={1.5}>
          {funnelStages.map((stage) => {
            const count = data ? countFor(stage) : 0;
            const pct = data?.total ? Math.min((count / data.total) * 100, 100) : 0;
            return (
              <Stack key={stage} direction="row" alignItems="center" spacing={2}>
                <Box sx={{ minWidth: 110 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {STAGE_LABELS[stage]}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, bgcolor: "grey.100", borderRadius: 1, overflow: "hidden" }}>
                  <Box
                    sx={{
                      width: `${pct}%`,
                      minWidth: pct > 0 ? 4 : 0,
                      bgcolor: STAGE_COLORS[stage],
                      height: 28,
                      transition: "width 0.3s ease",
                    }}
                  />
                </Box>
                <Box sx={{ minWidth: 70, textAlign: "right" }}>
                  <Typography variant="body2" fontWeight="bold">
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data ? `${pct.toFixed(1)}%` : "…"}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
