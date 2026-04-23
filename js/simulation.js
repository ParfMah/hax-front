/* ============================================================
   HaxFinance — Calcul de mensualité de prêt
   Formule : M = C × [t(1+t)^n] / [(1+t)^n - 1]
     M = mensualité
     C = capital emprunté
     t = taux mensuel (taux annuel / 12)
     n = durée en mois
   ============================================================ */

/* ── Taux par type de prêt ─────────────────────────────── */
const TAUX = {
  'personnel':   3.0,
  'immobilier':  2.1,
  'automobile':  2.7,
  'rachat':      2.8
};

/* ── Éléments du DOM ─────────────────────────────────────── */
const form          = document.getElementById('form-simulation');
const sliderDuree   = document.getElementById('duree');
const afficheDuree  = document.getElementById('affiche-duree');
const inputMontant  = document.getElementById('montant');
const selectType    = document.getElementById('type-pret');
const inputRevenu   = document.getElementById('revenu');

// Résultat
const resMensualite   = document.getElementById('res-mensualite');
const resTauxAff      = document.getElementById('res-taux');
const resMontant      = document.getElementById('res-montant');
const resDuree        = document.getElementById('res-duree');
const resCoutTotal    = document.getElementById('res-cout-total');
const resInterets     = document.getElementById('res-interets');
const barreCapital    = document.getElementById('barre-capital');
const barreInterets   = document.getElementById('barre-interets');
const resTauxEndett   = document.getElementById('res-taux-endett');
const resIndicateur   = document.getElementById('indicateur-endett');

/* ── Mise à jour de l'affichage de la durée ─────────────── */
if (sliderDuree && afficheDuree) {
  sliderDuree.addEventListener('input', () => {
    const mois = parseInt(sliderDuree.value);
    const annees = Math.floor(mois / 12);
    const moisRest = mois % 12;
    let texte = '';
    if (annees > 0) texte += `${annees} an${annees > 1 ? 's' : ''}`;
    if (moisRest > 0) texte += ` ${moisRest} mois`;
    afficheDuree.textContent = texte.trim() || `${mois} mois`;
    calculer();
  });
}

/* ── Calcul principal ────────────────────────────────────── */
function calculer() {
  const montant   = parseFloat(inputMontant?.value) || 0;
  const type      = selectType?.value || 'personnel';
  const dureeAns  = parseInt(sliderDuree?.value) || 12;
  const tauxAnn   = TAUX[type] / 100;    // ex. 0.03
  const tauxMens  = tauxAnn / 12;        // taux mensuel
  const n         = dureeAns;            // nombre de mois

  if (montant <= 0 || n <= 0) {
    afficherResultat(0, 0, type, montant, n);
    return;
  }

  let mensualite;
  if (tauxMens === 0) {
    // Cas particulier taux = 0 (pas de notre cas ici)
    mensualite = montant / n;
  } else {
    // Formule standard prêt amortissable
    mensualite = montant * (tauxMens * Math.pow(1 + tauxMens, n))
               / (Math.pow(1 + tauxMens, n) - 1);
  }

  afficherResultat(mensualite, tauxAnn, type, montant, n);
}

/* ── Affichage du résultat ───────────────────────────────── */
function afficherResultat(mensualite, tauxAnn, type, montant, n) {
  const coutTotal    = mensualite * n;
  const totalInterets = Math.max(0, coutTotal - montant);
  const tauxAff      = (TAUX[type] || 0).toFixed(1);

  const fmt = (val) => val.toLocaleString('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  // Mensualité principale
  if (resMensualite) {
    resMensualite.textContent = mensualite > 0 ? fmt(mensualite) + ' €' : '— €';
  }

  // Détails
  if (resTauxAff)    resTauxAff.textContent    = tauxAff + ' %';
  if (resMontant)    resMontant.textContent     = montant > 0 ? fmt(montant) + ' €' : '— €';
  if (resDuree)      resDuree.textContent       = `${n} mois`;
  if (resCoutTotal)  resCoutTotal.textContent   = mensualite > 0 ? fmt(coutTotal) + ' €' : '— €';
  if (resInterets)   resInterets.textContent    = mensualite > 0 ? fmt(totalInterets) + ' €' : '— €';

  // Barres proportionnelles capital / intérêts
  if (barreCapital && barreInterets && coutTotal > 0) {
    const pctCapital = (montant / coutTotal) * 100;
    barreCapital.style.width  = pctCapital + '%';
    barreInterets.style.width = (100 - pctCapital) + '%';
  }

  // Taux d'endettement (si revenu renseigné)
  const revenu = parseFloat(inputRevenu?.value) || 0;
  if (resTauxEndett && resIndicateur && mensualite > 0 && revenu > 0) {
    const tauxEndt = (mensualite / revenu) * 100;
    resTauxEndett.textContent = tauxEndt.toFixed(1) + ' %';
    resIndicateur.className = 'indicateur';
    if (tauxEndt <= 33) {
      resIndicateur.classList.add('vert');
      resIndicateur.title = 'Taux d\'endettement acceptable (≤ 33%)';
    } else if (tauxEndt <= 40) {
      resIndicateur.classList.add('orange');
      resIndicateur.title = 'Taux d\'endettement élevé (33-40%)';
    } else {
      resIndicateur.classList.add('rouge');
      resIndicateur.title = 'Taux d\'endettement trop élevé (> 40%)';
    }
  } else if (resTauxEndett) {
    resTauxEndett.textContent = '—';
    if (resIndicateur) resIndicateur.className = 'indicateur';
  }
}

/* ── Validation du formulaire ───────────────────────────── */
function validerChamp(input, conditionErreur, messageErreur) {
  const groupe = input.closest('.form-groupe');
  if (!groupe) return true;
  const msgEl  = groupe.querySelector('.erreur');

  if (conditionErreur) {
    groupe.classList.add('invalide');
    if (msgEl) msgEl.textContent = messageErreur;
    return false;
  } else {
    groupe.classList.remove('invalide');
    return true;
  }
}

function validerFormulaire() {
  let valide = true;

  const nom      = document.getElementById('nom');
  const prenom   = document.getElementById('prenom');
  const email    = document.getElementById('email');
  const tel      = document.getElementById('tel');

  if (nom && !validerChamp(nom, nom.value.trim().length < 2, 'Veuillez entrer votre nom.')) valide = false;
  if (prenom && !validerChamp(prenom, prenom.value.trim().length < 2, 'Veuillez entrer votre prénom.')) valide = false;
  if (email && !validerChamp(email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value), 'Adresse email invalide.')) valide = false;
  if (tel && !validerChamp(tel, !/^[\d\s\+\-\.]{9,15}$/.test(tel.value), 'Numéro de téléphone invalide.')) valide = false;

  if (inputMontant && !validerChamp(inputMontant,
    !inputMontant.value || parseFloat(inputMontant.value) < 1000,
    'Le montant minimum est 1 000 €.')) valide = false;

  if (inputRevenu && !validerChamp(inputRevenu,
    !inputRevenu.value || parseFloat(inputRevenu.value) <= 0,
    'Veuillez entrer vos revenus mensuels.')) valide = false;

  return valide;
}

/* ── Écouteurs d'événements ──────────────────────────────── */
if (inputMontant)  inputMontant.addEventListener('input', calculer);
if (selectType)    selectType.addEventListener('change', calculer);
if (inputRevenu)   inputRevenu.addEventListener('input', calculer);

// Soumission du formulaire
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validerFormulaire()) return;

    // Simulation d'envoi réussi
    const bouton = form.querySelector('button[type="submit"]');
    if (bouton) {
      bouton.textContent = '✓ Demande envoyée !';
      bouton.style.background = 'var(--vert)';
      bouton.disabled = true;
      setTimeout(() => {
        bouton.textContent = 'Envoyer ma demande';
        bouton.style.background = '';
        bouton.disabled = false;
        form.reset();
        if (sliderDuree && afficheDuree) {
          afficheDuree.textContent = '12 mois';
        }
        calculer();
      }, 3500);
    }
  });
}

// Validation en temps réel (enlever le message d'erreur dès correction)
document.querySelectorAll('.form-groupe input, .form-groupe select').forEach(input => {
  input.addEventListener('blur', () => {
    const groupe = input.closest('.form-groupe');
    if (groupe?.classList.contains('invalide')) {
      // Retenter la validation
      const err = groupe.querySelector('.erreur');
      if (input.value.trim()) {
        groupe.classList.remove('invalide');
      }
    }
  });
});

/* ── Initialisation ──────────────────────────────────────── */
// Lancer le calcul avec les valeurs par défaut au chargement
window.addEventListener('DOMContentLoaded', () => {
  if (sliderDuree && afficheDuree) {
    const mois = parseInt(sliderDuree.value);
    afficheDuree.textContent = `${Math.floor(mois/12)} an${mois/12 > 1 ? 's' : ''}`;
  }
  calculer();
});