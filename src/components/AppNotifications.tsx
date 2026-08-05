import React from "react";
import { notification } from "antd";

// ─── Auth Required ──────────────────────────────────────────────────────────

export const showAuthRequiredNotification = () => {
  notification.open({
    message: (
      <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
        Inicia sesión para continuar
      </span>
    ),
    description: (
      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        Necesitas una cuenta para usar el agente de traducción. Es gratis y rápido.
      </span>
    ),
    icon: (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
    ),
    placement: "topRight",
    duration: 5,
    style: {
      borderRadius: 14,
      boxShadow:
        "0 8px 32px rgba(99,102,241,0.18), 0 2px 8px rgba(0,0,0,0.08)",
      border: "1px solid #e0e7ff",
      padding: "14px 18px",
    },
  });
};

// ─── API Key Required ────────────────────────────────────────────────────────

export const showApiKeyRequiredNotification = () => {
  notification.open({
    message: (
      <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
        API Key requerida
      </span>
    ),
    description: (
      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        Agrega una API key de tu proveedor preferido para activar las traducciones.
      </span>
    ),
    icon: (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      </div>
    ),
    placement: "topRight",
    duration: 6,
    style: {
      borderRadius: 14,
      boxShadow:
        "0 8px 32px rgba(245,158,11,0.15), 0 2px 8px rgba(0,0,0,0.08)",
      border: "1px solid #fef3c7",
      padding: "14px 18px",
    },
  });
};
