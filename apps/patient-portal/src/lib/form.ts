export type Categorie = 'PARTICULIER' | 'INSTITUTION';

/** Statut juridique du patient — détermine si l’autorité parentale / tutelle est requise. */
export type StatutPatient =
  | ''
  | 'ADULTE'
  | 'ENFANT_SOUS_TUTELLE'
  | 'ADULTE_SOUS_TUTELLE';

export const STATUT_PATIENT_OPTIONS: { value: Exclude<StatutPatient, ''>; label: string; needsTuteur: boolean }[] = [
  { value: 'ADULTE', label: 'Adulte (capable)', needsTuteur: false },
  { value: 'ENFANT_SOUS_TUTELLE', label: 'Enfant sous tutelle / autorité parentale', needsTuteur: true },
  { value: 'ADULTE_SOUS_TUTELLE', label: 'Adulte sous tutelle', needsTuteur: true },
];

export function needsAutoriteParentale(statut: StatutPatient) {
  return STATUT_PATIENT_OPTIONS.some((o) => o.value === statut && o.needsTuteur);
}

export type FormState = {
  categorie: Categorie | '';
  partenaireId: string;
  institution: {
    nom: string;
    adresse: string;
    telephone: string;
    contactNom: string;
    contactPrenom: string;
    contactAdresse: string;
    contactTelephone: string;
    contactFax: string;
    contactEmail: string;
  };
  identite: {
    nom: string;
    nomNaissance: string;
    prenom: string;
    dateNaissance: string;
    lieuNaissance: string;
    paysNaissance: string;
    nationaliteActuelle: string;
    nationaliteNaissance: string;
    autresNationalites: string;
    sexe: '' | 'MASCULIN' | 'FEMININ';
    etatCivil: string;
    numeroPieceIdentite: string;
    statutPatient: StatutPatient;
  };
  tuteur: {
    nom: string;
    prenom: string;
    adresse: string;
    telephone: string;
    email: string;
    nationalite: string;
  };
  coordonnees: {
    adresse: string;
    email: string;
    telephone: string;
  };
  residenceEtrangere: {
    oui: boolean | null;
    numeroAutorisation: string;
    expirationAutorisation: string;
  };
  documentVoyage: {
    type: string;
    numero: string;
    dateDelivrance: string;
    dateExpiration: string;
    paysDelivrance: string;
  };
  professionnel: {
    profession: string;
    employeurNom: string;
    employeurAdresse: string;
    employeurTelephone: string;
  };
  confirmationExactitude: boolean;
  website: string;
};

export const emptyForm = (): FormState => ({
  categorie: '',
  partenaireId: '',
  institution: {
    nom: '',
    adresse: '',
    telephone: '',
    contactNom: '',
    contactPrenom: '',
    contactAdresse: '',
    contactTelephone: '',
    contactFax: '',
    contactEmail: '',
  },
  identite: {
    nom: '',
    nomNaissance: '',
    prenom: '',
    dateNaissance: '',
    lieuNaissance: '',
    paysNaissance: '',
    nationaliteActuelle: '',
    nationaliteNaissance: '',
    autresNationalites: '',
    sexe: '',
    etatCivil: '',
    numeroPieceIdentite: '',
    statutPatient: '',
  },
  tuteur: {
    nom: '',
    prenom: '',
    adresse: '',
    telephone: '',
    email: '',
    nationalite: '',
  },
  coordonnees: { adresse: '', email: '', telephone: '' },
  residenceEtrangere: {
    oui: null,
    numeroAutorisation: '',
    expirationAutorisation: '',
  },
  documentVoyage: {
    type: 'PASSEPORT_ORDINAIRE',
    numero: '',
    dateDelivrance: '',
    dateExpiration: '',
    paysDelivrance: '',
  },
  professionnel: {
    profession: '',
    employeurNom: '',
    employeurAdresse: '',
    employeurTelephone: '',
  },
  confirmationExactitude: false,
  website: '',
});

export const ETAT_CIVIL = [
  'Célibataire',
  'Marié(e)',
  'Partenariat enregistré',
  'Séparé(e)',
  'Divorcé(e)',
  'Veuf / Veuve',
  'Autre',
];

export const DOC_TYPES = [
  { value: 'PASSEPORT_ORDINAIRE', label: 'Passeport ordinaire' },
  { value: 'PASSEPORT_DIPLOMATIQUE', label: 'Passeport diplomatique' },
  { value: 'PASSEPORT_SERVICE', label: 'Passeport de service' },
  { value: 'PASSEPORT_OFFICIEL', label: 'Passeport officiel' },
  { value: 'PASSEPORT_SPECIAL', label: 'Passeport spécial' },
  { value: 'AUTRE', label: 'Autre document de voyage' },
];

export type StepId =
  | 'profil'
  | 'identite'
  | 'coordonnees'
  | 'voyage'
  | 'pro'
  | 'institution'
  | 'photo'
  | 'verification'
  | 'confirmation';

export function stepsFor(categorie: Categorie | ''): { id: StepId; label: string }[] {
  const base: { id: StepId; label: string }[] = [
    { id: 'profil', label: 'Profil' },
    { id: 'identite', label: 'Identité' },
    { id: 'coordonnees', label: 'Coordonnées' },
    { id: 'voyage', label: 'Voyage' },
  ];
  if (categorie !== 'INSTITUTION') {
    base.push({ id: 'pro', label: 'Profession' });
  }
  if (categorie === 'INSTITUTION') {
    base.push({ id: 'institution', label: 'Institution' });
  }
  base.push(
    { id: 'photo', label: 'Photo' },
    { id: 'verification', label: 'Vérification' },
    { id: 'confirmation', label: 'Confirmation' },
  );
  return base;
}
