import React, { useEffect } from "react";
import { notification } from "antd";
import { AUTH_MESSAGES } from "../utils/authConstants";

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

// ─── Generic Toasts ────────────────────────────────────────────────────────

export const showSuccessToast = (title: string, description?: string) => {
  notification.open({
    message: <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>,
    description: description ? <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{description}</span> : undefined,
    icon: (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    ),
    placement: "topRight",
    style: { borderRadius: 14, boxShadow: "0 8px 32px rgba(16,185,129,0.15), 0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #d1fae5", padding: "14px 18px" },
  });
};

export const showErrorToast = (title: string, description?: string) => {
  notification.open({
    message: <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>,
    description: description ? <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{description}</span> : undefined,
    icon: (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #f43f5e, #e11d48)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
    ),
    placement: "topRight",
    style: { borderRadius: 14, boxShadow: "0 8px 32px rgba(244,63,94,0.15), 0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #ffe4e6", padding: "14px 18px" },
  });
};

export const showWarningToast = (title: string, description?: string) => {
  notification.open({
    message: <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>,
    description: description ? <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{description}</span> : undefined,
    icon: (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
    ),
    placement: "topRight",
    style: { borderRadius: 14, boxShadow: "0 8px 32px rgba(245,158,11,0.15), 0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #fef3c7", padding: "14px 18px" },
  });
};

export const showInfoToast = (title: string, description?: string) => {
  notification.open({
    message: <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{title}</span>,
    description: description ? <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{description}</span> : undefined,
    icon: (
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </div>
    ),
    placement: "topRight",
    style: { borderRadius: 14, boxShadow: "0 8px 32px rgba(59,130,246,0.15), 0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #dbeafe", padding: "14px 18px" },
  });
};

export const AppNotificationListener = () => {
  useEffect(() => {
    const action = sessionStorage.getItem("authAction");
    if (action === "login_success") {
      showSuccessToast(AUTH_MESSAGES.LOGIN_SUCCESS);
      sessionStorage.removeItem("authAction");
    } else if (action === "logout_success") {
      showSuccessToast(AUTH_MESSAGES.LOGOUT_SUCCESS);
      sessionStorage.removeItem("authAction");
    } else if (action === "register_success") {
      showSuccessToast(AUTH_MESSAGES.REGISTER_SUCCESS);
      sessionStorage.removeItem("authAction");
    }
  }, []);

  return null;
};
