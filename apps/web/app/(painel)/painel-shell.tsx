"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import ChatIcon from "@mui/icons-material/Chat";
import PeopleIcon from "@mui/icons-material/People";
import WifiIcon from "@mui/icons-material/Wifi";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CampaignIcon from "@mui/icons-material/Campaign";
import SettingsIcon from "@mui/icons-material/Settings";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { logoutAction } from "@/lib/logout-action";
import { useBranding } from "@/lib/branding";

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/kanban", label: "Kanban", icon: <ViewKanbanIcon /> },
  { href: "/atendimentos", label: "Atendimentos", icon: <ChatIcon /> },
  { href: "/clientes", label: "Clientes", icon: <PeopleIcon /> },
  { href: "/planos", label: "Planos", icon: <WifiIcon /> },
  { href: "/pacotes", label: "Pacotes", icon: <Inventory2Icon /> },
  { href: "/promocoes", label: "Promoções", icon: <LocalOfferIcon /> },
  { href: "/areas", label: "Áreas", icon: <LocationOnIcon /> },
  { href: "/origens", label: "Origens", icon: <CampaignIcon /> },
  { href: "/configuracoes", label: "Configurações", icon: <SettingsIcon /> },
  { href: "/documentacao", label: "Documentação", icon: <MenuBookIcon /> },
  { href: "/logs", label: "Logs do Sistema", icon: <ReceiptLongIcon /> },
];

/** Logo retangular (larga): altura fixa, largura automática até maxWidth. */
function BrandMark({ height = 32, maxWidth = 140 }: { height?: number; maxWidth?: number }) {
  const { branding } = useBranding();
  if (!branding.brandLogo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branding.brandLogo}
      alt=""
      height={height}
      style={{
        height,
        width: "auto",
        maxWidth,
        objectFit: "contain",
        borderRadius: 4,
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}

export default function PainelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { branding } = useBranding();

  const drawerContent = (
    <>
      <Toolbar
        sx={{
          gap: 1.5,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
          minHeight: 64,
        }}
      >
        {branding.brandLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.brandLogo}
            alt={branding.brandName}
            height={36}
            style={{
              height: 36,
              width: "auto",
              maxWidth: 160,
              objectFit: "contain",
              borderRadius: 4,
              flexShrink: 0,
              display: "block",
            }}
          />
        ) : null}
        <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.2 }}>
          {branding.brandName}
        </Typography>
      </Toolbar>
      <List>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={pathname === item.href}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 0.5, display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <BrandMark />
            <Typography variant="h6" noWrap>
              {branding.brandName}
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={() => logoutAction()} title="Sair">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
