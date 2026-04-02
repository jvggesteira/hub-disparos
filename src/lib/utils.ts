import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Função para obter iniciais do nome (Adicione isso no final do arquivo)
export function getInitials(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.charAt(0).toUpperCase() || '';
  const last = lastName?.charAt(0).toUpperCase() || '';
  
  // Se não tiver nome, retorna 'GM' (padrão)
  if (!first && !last) return 'GM';
  
  return first + last;
}