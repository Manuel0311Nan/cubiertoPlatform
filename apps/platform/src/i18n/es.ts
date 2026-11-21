/**
 * Textos de la interfaz en español de España (CLAUDE.md §7). Tuteo, frases cortas, sin mayúsculas
 * en etiquetas y botones que dicen lo que pasa (specs/diseno/README.md §3).
 */
export const es = {
  brand: {
    name: "Cubierto",
  },
  signIn: {
    metaTitle: "Entra en tu panel · Cubierto",
    tagline: "El panel de tu restaurante.",
    taglineDetail: "Reservas, sala, carta y web en un mismo sitio.",
    title: "Entra en tu panel",
    intro: "Escribe tu email y te mandamos un enlace para entrar. No hace falta contraseña.",
    emailLabel: "Email",
    emailError: "Escribe un email válido, por ejemplo nombre@turestaurante.es.",
    submit: "Enviarme el enlace",
    submitting: "Enviando el enlace…",
    hint: "El enlace caduca en 15 minutos. ¿No tienes acceso? Pídeselo a quien gestiona el panel en tu local.",
    linkInvalid: "Ese enlace ya no sirve: caduca a los 15 minutos y solo se puede usar una vez. Pide uno nuevo.",
    sendFailed: "No hemos podido enviar el enlace. Inténtalo de nuevo en un momento.",
    errorLabel: "Error",
    checkTitle: "Revisa tu correo",
    checkBodyBefore: "Si ",
    checkBodyAfter: " tiene acceso al panel, te acabamos de enviar un enlace para entrar. Ábrelo desde este dispositivo.",
    checkHint: "El enlace caduca en 15 minutos. Si no lo ves, mira en la carpeta de spam.",
    resend: "Reenviar el enlace",
    resending: "Reenviando…",
    resent: "Te hemos enviado otro enlace.",
    otherEmail: "Usar otro email",
  },
  panel: {
    metaTitle: "Panel · Cubierto",
    greeting: "Hola",
    comingSoon: "Ya has entrado. El panel de tu local llega en el siguiente paso.",
    signOut: "Salir",
  },
  email: {
    magicLink: {
      subject: "Tu enlace para entrar en Cubierto",
      title: "Entra en tu panel",
      body: "Pulsa el botón para entrar en Cubierto. El enlace caduca en 15 minutos y solo se puede usar una vez.",
      cta: "Entrar en el panel",
      fallback: "Si el botón no funciona, copia esta dirección en el navegador:",
      ignore: "Si no has pedido este enlace, puedes ignorar este email: nadie puede entrar sin él.",
    },
  },
} as const;

export type Dictionary = typeof es;
