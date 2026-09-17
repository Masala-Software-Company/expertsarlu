import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  timeout: 60_000,
});

export type Institution = { id: string; nom: string; pays?: string | null };

export function formatApiError(err: unknown, fallback: string) {
  const ax = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  if (!ax.response) {
    if (ax.code === 'ERR_NETWORK' || ax.message === 'Network Error') {
      return 'Impossible de joindre le serveur Expert SARLU. Vérifiez votre connexion ou réessayez dans quelques minutes.';
    }
    return fallback;
  }
  const status = ax.response.status;
  const raw = ax.response.data?.message;
  const msg = Array.isArray(raw) ? raw.join(' · ') : raw;
  if (status === 404) {
    return 'Le service de pré-inscription n’est pas encore disponible sur le serveur. Réessayez après la mise à jour.';
  }
  if (status === 413) return 'Un des fichiers est trop volumineux (photo max. 5 Mo, documents max. 10 Mo).';
  if (status === 409) {
    return msg
      ? String(msg)
      : 'Une demande existe déjà pour ces informations. Vous ne pouvez pas vous enregistrer une seconde fois.';
  }
  if (status === 429) return 'Trop de tentatives. Attendez une minute puis réessayez.';
  if (msg) return String(msg);
  return fallback;
}

export async function fetchInstitutions() {
  const { data } = await api.get<Institution[]>('/public/institutions');
  return data;
}

export async function submitPreInscription(
  payload: unknown,
  files: { photo: File; passeport: File; documentMedical?: File | null },
) {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('photo', files.photo);
  form.append('passeport', files.passeport);
  if (files.documentMedical) {
    form.append('documentMedical', files.documentMedical);
  }
  const { data } = await api.post<{
    reference: string;
    statut: string;
    message: string;
  }>('/public/pre-inscriptions', form);
  return data;
}
