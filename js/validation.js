import { z } from "https://cdn.jsdelivr.net/npm/zod@4.6.5/+esm";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingresa tu correo.").email("Correo inválido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export const nuevaOrdenSchema = z.object({
  obra_id: z.string().min(1, "Selecciona una obra."),
  piso: z.string().trim().min(1, "El piso/lugar es obligatorio."),
  contratista: z.string().trim().min(1, "El contratista es obligatorio."),
  fecha_hora: z.string().min(1, "La fecha y hora son obligatorias."),
});

export const createUserSchema = z.object({
  email: z.string().trim().min(1, "Ingresa el correo.").email("Correo inválido."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  role: z.enum(["empleado", "admin", "superadmin"]),
});

export const editUserSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  role: z.enum(["empleado", "admin", "superadmin"]),
  activo: z.boolean(),
});

export const editObraSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre de la obra es obligatorio."),
  activa: z.boolean(),
});

export const createObraSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre de la obra es obligatorio."),
});

export function firstErrorMessage(result) {
  return result.error.issues[0]?.message ?? "Datos inválidos.";
}
