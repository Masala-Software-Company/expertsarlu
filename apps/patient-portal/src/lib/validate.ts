import { needsAutoriteParentale, type FormState } from './form';

export type FieldErrors = Record<string, string>;

export function validateStep(step: string, form: FormState): FieldErrors {
  const e: FieldErrors = {};

  if (step === 'profil') {
    if (!form.categorie) e.categorie = 'Choisissez un type de dossier';
  }

  if (step === 'identite') {
    if (!form.identite.nom.trim()) e['identite.nom'] = 'Nom obligatoire';
    if (!form.identite.prenom.trim()) e['identite.prenom'] = 'Prénom obligatoire';
    if (!form.identite.dateNaissance) e['identite.dateNaissance'] = 'Date obligatoire';
    if (!form.identite.nationaliteActuelle.trim()) {
      e['identite.nationaliteActuelle'] = 'Nationalité obligatoire';
    }
    if (!form.identite.sexe) e['identite.sexe'] = 'Sélectionnez une option';
    if (!form.identite.etatCivil) e['identite.etatCivil'] = 'Sélectionnez une option';
    if (!form.identite.statutPatient) {
      e['identite.statutPatient'] = 'Indiquez le statut du patient';
    }
    if (needsAutoriteParentale(form.identite.statutPatient)) {
      if (!form.tuteur.nom.trim()) e['tuteur.nom'] = 'Nom du tuteur obligatoire';
      if (!form.tuteur.prenom.trim()) e['tuteur.prenom'] = 'Prénom du tuteur obligatoire';
      if (!form.tuteur.telephone.trim()) e['tuteur.telephone'] = 'Téléphone obligatoire';
    }
  }

  if (step === 'coordonnees') {
    if (!form.coordonnees.adresse.trim()) e['coordonnees.adresse'] = 'Adresse obligatoire';
    if (!form.coordonnees.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.coordonnees.email)) {
      e['coordonnees.email'] = 'E-mail invalide';
    }
    if (!form.coordonnees.telephone.trim() || form.coordonnees.telephone.replace(/\D/g, '').length < 8) {
      e['coordonnees.telephone'] = 'Numéro WhatsApp invalide';
    }
    if (form.residenceEtrangere.oui === null) {
      e['residenceEtrangere.oui'] = 'Répondez à cette question';
    }
    if (form.residenceEtrangere.oui) {
      if (!form.residenceEtrangere.numeroAutorisation.trim()) {
        e['residenceEtrangere.numeroAutorisation'] = 'Numéro obligatoire';
      }
      if (!form.residenceEtrangere.expirationAutorisation) {
        e['residenceEtrangere.expirationAutorisation'] = 'Date obligatoire';
      }
    }
  }

  if (step === 'voyage') {
    if (!form.documentVoyage.numero.trim()) e['documentVoyage.numero'] = 'Numéro obligatoire';
    if (!form.documentVoyage.dateDelivrance) e['documentVoyage.dateDelivrance'] = 'Date obligatoire';
    if (!form.documentVoyage.dateExpiration) e['documentVoyage.dateExpiration'] = 'Date obligatoire';
    if (!form.documentVoyage.paysDelivrance.trim()) {
      e['documentVoyage.paysDelivrance'] = 'Pays obligatoire';
    }
    if (
      form.documentVoyage.dateDelivrance &&
      form.documentVoyage.dateExpiration &&
      !(new Date(form.documentVoyage.dateExpiration) > new Date(form.documentVoyage.dateDelivrance))
    ) {
      e['documentVoyage.dateExpiration'] =
        'L’expiration doit être postérieure à la délivrance';
    }
  }

  if (step === 'institution') {
    if (!form.partenaireId) {
      e.institution = 'Sélectionnez une institution partenaire dans la liste';
    }
  }

  if (step === 'verification') {
    if (!form.confirmationExactitude) {
      e.confirmationExactitude = 'Confirmez l’exactitude des informations';
    }
  }

  return e;
}
