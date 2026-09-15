import { useMemo } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import logoBlue from '@/assets/logos/logo-blue.png';

export type InvoicePreviewData = {
  titre: 'FACTURE' | 'DEVIS' | string;
  numero: string;
  patient?: string | null;
  dossierNumero?: string | null;
  codeVerification?: string | null;
  emisLe?: string | Date | null;
  lignes: { code?: string; description: string; quantite?: number; montant: number }[];
  total: number;
  paye?: number;
  devise?: string;
};

const COMPANY = {
  name: "L'EXPERT SARLU",
  tagline: 'Évacuation & Mobilité Médicale Internationale',
  rccm: 'CD/KNG/RCCM/26-B-02466',
  idNat: '01-F4300-N00001D',
  impot: 'A2625365A',
};

/** Aperçu fidèle à la facture PDF (impression / envoi client). */
export function InvoicePreviewModal({
  data,
  onClose,
  onDownload,
}: {
  data: InvoicePreviewData;
  onClose: () => void;
  onDownload?: () => void;
}) {
  const code = data.codeVerification || '—';
  const paye = data.paye ?? (String(data.titre).toUpperCase() === 'FACTURE' ? data.total : 0);
  const reste = Math.max(0, data.total - paye);
  const emis = data.emisLe ? new Date(data.emisLe) : new Date();

  const qrUrl = useMemo(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
      /\/$/,
      '',
    );
    // Hors /api : URL publique de vérification
    const origin = apiBase.replace(/\/api$/, '');
    const payload =
      code && code !== '—'
        ? `${origin}/v/${encodeURIComponent(code)}`
        : `eXpert SARLU · ${data.titre} ${data.numero}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(payload)}`;
  }, [code, data.numero, data.titre]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Prévisualisation — {data.numero}
            </h3>
            <p className="text-sm text-slate-500">
              Facture réimprimable à tout moment depuis son historique.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-auto bg-slate-100 p-4 sm:p-6">
          <article className="mx-auto max-w-[720px] bg-white p-6 text-slate-900 shadow-sm sm:p-8 print:shadow-none">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <img src={logoBlue} alt="eXpert" className="h-10 w-auto object-contain" />
                <div>
                  <div className="text-sm font-extrabold tracking-wide">{COMPANY.name}</div>
                  <div className="max-w-[220px] text-[11px] text-slate-500">{COMPANY.tagline}</div>
                </div>
              </div>
              <div className="text-right text-[11px] leading-relaxed text-slate-600">
                <div>RCCM : {COMPANY.rccm}</div>
                <div>ID NAT : {COMPANY.idNat}</div>
                <div>N° IMPÔT : {COMPANY.impot}</div>
              </div>
            </header>

            <div className="mt-6 flex items-stretch gap-3 border-l-4 border-[#144EB9] pl-4">
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#144EB9]">
                  {data.titre}
                </div>
                <div className="text-xl font-extrabold">{data.numero}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Émise le</div>
                <div className="font-semibold">
                  {emis.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
              <Meta label="Client" value={data.patient || '—'} />
              <Meta label="Dossier" value={data.dossierNumero || '—'} />
              <Meta label="Code de vérification" value={code} />
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="bg-[#EEF3FB] text-left text-xs font-bold uppercase tracking-wide text-[#144EB9]">
                  <th className="rounded-l-lg px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Frais</th>
                  <th className="px-3 py-2.5 text-right">Qté</th>
                  <th className="rounded-r-lg px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.lignes.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium">{l.code ?? '—'}</td>
                    <td className="px-3 py-2.5">{l.description}</td>
                    <td className="px-3 py-2.5 text-right">{l.quantite ?? 1}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatMoney(l.montant, data.devise ?? 'USD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 ml-auto w-full max-w-[220px] space-y-1.5 text-sm">
              <TotalRow label="Total" value={formatMoney(data.total, data.devise ?? 'USD')} />
              <TotalRow label="Payé" value={formatMoney(paye, data.devise ?? 'USD')} />
              <TotalRow label="Reste" value={formatMoney(reste, data.devise ?? 'USD')} bold />
            </div>

            <footer className="mt-10 flex items-center gap-4 border-t border-slate-100 pt-5">
              <img src={qrUrl} alt="QR authentification" className="h-16 w-16 rounded-md border border-slate-200" />
              <div>
                <div className="text-xs text-slate-500">Authentification du document</div>
                <div className="text-base font-extrabold tracking-wide text-[#144EB9]">{code}</div>
              </div>
            </footer>
          </article>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />{' '}
            Imprimer {String(data.titre).toUpperCase().includes('FACTURE') ? 'la facture' : 'le devis'}
          </Button>
          {onDownload && (
            <Button onClick={onDownload}>
              <Download className="h-4 w-4" /> Télécharger PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-extrabold' : 'font-semibold'}>{value}</span>
    </div>
  );
}
