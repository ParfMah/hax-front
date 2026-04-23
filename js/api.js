// ════════════════════════════════════════════════════════════════
//  js/api.js — Connecteur Frontend → Backend
//
//  Ce fichier fait le lien entre votre formulaire HTML et
//  votre backend Node.js via fetch() (l'API native du navigateur).
//
//  UTILISATION :
//  Copiez ce fichier dans : haxfinance/js/api.js
//  Puis dans simulation.html, ajoutez APRÈS les autres scripts :
//    <script src="../js/api.js"></script>
// ════════════════════════════════════════════════════════════════

// ── URL de votre backend ────────────────────────────────────
// En développement : http://localhost:5000
// En production    : https://votre-domaine.com
const API_BASE_URL = 'https://hax-back.onrender.com';


// ════════════════════════════════════════════════════════════════
//  CONNEXION AU FORMULAIRE DE SIMULATION
// ════════════════════════════════════════════════════════════════
const formSimulation = document.getElementById('form-simulation');

if (formSimulation) {

  // On écoute la soumission du formulaire
  formSimulation.addEventListener('submit', async function(e) {
    e.preventDefault();          // Empêche le rechargement de la page
    e.stopImmediatePropagation(); // Évite les conflits avec simulation.js

    // ── Étape 1 : Validation côté client (simulation.js) ───
    if (typeof validerFormulaire === 'function' && !validerFormulaire()) {
      return; // Arrête si des champs sont invalides
    }

    // ── Étape 2 : Récupérer les valeurs du formulaire ──────
    const donnees = {
      prenom:          document.getElementById('prenom')?.value?.trim()    || '',
      nom:             document.getElementById('nom')?.value?.trim()       || '',
      email:           document.getElementById('email')?.value?.trim()     || '',
      telephone:       document.getElementById('tel')?.value?.trim()       || '',
      typePret:        document.getElementById('type-pret')?.value         || 'personnel',
      montant:         parseFloat(document.getElementById('montant')?.value)  || 0,
      duree:           parseInt(document.getElementById('duree')?.value)      || 12,
      revenusMensuels: parseFloat(document.getElementById('revenu')?.value)   || 0,
      situationPro:    document.getElementById('situation')?.value            || '',
      message:         document.getElementById('message')?.value?.trim()     || '',
    };

    // ── Étape 3 : Feedback visuel (bouton en chargement) ───
    const bouton = formSimulation.querySelector('button[type="submit"]');
    const texteOriginal = bouton?.textContent;
    if (bouton) {
      bouton.textContent = '⏳ Envoi en cours…';
      bouton.disabled    = true;
    }

    // ── Étape 4 : Appel à l'API via fetch() ───────────────
    try {
      const reponse = await fetch(`${API_BASE_URL}/api/loan-request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(donnees), // Convertit l'objet en JSON texte
      });

      // Lire la réponse JSON (qu'il y ait erreur ou succès)
      const json = await reponse.json();

      // ── Étape 5A : Succès ─────────────────────────────
      if (reponse.ok && json.succes) {
        afficherSucces(json.data);
        formSimulation.reset();
        if (bouton) {
          bouton.textContent    = '✓ Demande envoyée !';
          bouton.style.background = 'var(--vert)';
          setTimeout(() => {
            bouton.textContent    = texteOriginal;
            bouton.style.background = '';
            bouton.disabled       = false;
          }, 4000);
        }
      }
      // ── Étape 5B : Erreurs de validation (422) ────────
      else if (reponse.status === 422 && json.erreurs) {
        afficherErreursServeur(json.erreurs);
        if (bouton) { bouton.textContent = texteOriginal; bouton.disabled = false; }
      }
      // ── Étape 5C : Autre erreur serveur ───────────────
      else {
        afficherAlerte(json.message || 'Une erreur s\'est produite. Veuillez réessayer.');
        if (bouton) { bouton.textContent = texteOriginal; bouton.disabled = false; }
      }

    } catch (erreurReseau) {
      // Erreur réseau : serveur éteint, pas de connexion internet, etc.
      afficherAlerte(
        'Impossible de contacter le serveur.\n' +
        'Vérifiez que le backend tourne (npm run dev) et que votre connexion fonctionne.'
      );
      if (bouton) { bouton.textContent = texteOriginal; bouton.disabled = false; }
    }
  });
}


// ════════════════════════════════════════════════════════════════
//  FONCTIONS UTILITAIRES D'AFFICHAGE
// ════════════════════════════════════════════════════════════════

/**
 * Affiche un message de succès avec la référence de demande
 */
function afficherSucces(data) {
  const toast = document.getElementById('toast');
  if (toast) {
    const corps = toast.querySelector('div');
    if (corps) {
      corps.innerHTML = `
        <strong>🎉 Demande envoyée !</strong>
        <span>Référence : <b style="color:var(--vert)">${data.reference}</b></span>
        <span>Mensualité : <b>${parseFloat(data.mensualiteEstimee).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €/mois</b></span>
        <span style="font-size:.8rem;">Un conseiller vous contactera sous 24h.</span>
      `;
    }
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 7000);
  } else {
    // Fallback si le toast n'existe pas
    alert(`✅ Demande envoyée !\nRéférence : ${data.reference}\nMensualité : ${data.mensualiteEstimee} €/mois`);
  }
}

/**
 * Affiche les erreurs de validation renvoyées par le serveur
 * en colorant les champs problématiques
 */
function afficherErreursServeur(erreurs) {
  erreurs.forEach(function({ champ, message }) {
    // Chercher l'input correspondant au champ
    const input = document.getElementById(champ)
               || document.querySelector(`[name="${champ}"]`);
    if (!input) return;

    const groupe = input.closest('.form-groupe');
    if (groupe) {
      groupe.classList.add('invalide');
      const msgEl = groupe.querySelector('.erreur');
      if (msgEl) msgEl.textContent = message;
    }
  });
}

/**
 * Affiche une alerte d'erreur générique
 */
function afficherAlerte(message) {
  // Vous pouvez remplacer alert() par une vraie modale si vous le souhaitez
  alert('❌ ' + message);
}
