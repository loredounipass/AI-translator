export const AUTH_PROVIDERS = {
    EMAIL: "email",
    GITHUB: "github",
    FACEBOOK: "facebook",
} as const;

export type AuthProvider =
    (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

export const AUTH_ERRORS = {
    EMAIL_IN_USE: "Ya existe una cuenta con este correo electrónico",
    INVALID_CREDENTIALS: "Credenciales inválidas",
    WEAK_PASSWORD:
        "La contraseña debe tener al menos 6 caracteres",
    NETWORK_ERROR:
        "Error de conexión. Verifica tu conexión a internet.",
    USER_NOT_FOUND: "No existe una cuenta con este correo electrónico",
    UNKNOWN: "Ocurrió un error inesperado",
    PROVIDER_ERROR: "Error al conectar con el proveedor",
} as const;

export const AUTH_MESSAGES = {
    REGISTER_SUCCESS: "Cuenta creada exitosamente",
    LOGIN_SUCCESS: "Inicio de sesión exitoso",
    LOGOUT_SUCCESS: "Sesión cerrada",
    VERIFICATION_EMAIL:
        "Revisa tu correo para verificar tu cuenta",
} as const;
