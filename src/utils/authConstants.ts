export const AUTH_ERRORS = {
    INVALID_CREDENTIALS: "Credenciales inválidas",
    WEAK_PASSWORD:
        "La contraseña debe tener al menos 8 caracteres",
    NETWORK_ERROR:
        "Error de conexión. Verifica tu conexión a internet.",
    UNKNOWN: "Ocurrió un error inesperado. Intenta de nuevo.",
    PROVIDER_ERROR: "Error al conectar con el proveedor",
} as const;

export const AUTH_MESSAGES = {
    REGISTER_SUCCESS: "Cuenta creada exitosamente. Revisa tu correo para verificar tu cuenta.",
    LOGIN_SUCCESS: "Inicio de sesión exitoso",
    LOGOUT_SUCCESS: "Sesión cerrada",
    VERIFICATION_EMAIL:
        "Revisa tu correo para verificar tu cuenta antes de continuar.",
} as const;
