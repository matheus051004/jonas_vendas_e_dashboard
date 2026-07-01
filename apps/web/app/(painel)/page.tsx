"use client";

import * as React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

const STAGE_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo lead",
  INTERESSADO: "Interessado",
  FECHOU_VENDA: "Fechou venda",
  DESISTIU: "Desistiu",
};

interface DashboardData {
  total: number;
  byStage: { stage: string; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  const countFor = (stage: string) => data?.byStage.find((s) => s.stage === stage)?.count ?? 0;

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Dashboard
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Total de leads</Typography>
              <Typography variant="h3">{data?.total ?? "…"}</Typography>
            </CardContent>
          </Card>
        </Grid>
        {Object.entries(STAGE_LABELS).map(([stage, label]) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stage}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{label}</Typography>
                <Typography variant="h3">{data ? countFor(stage) : "…"}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
