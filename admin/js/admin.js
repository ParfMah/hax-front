// ============================================================
//  HaxFinance Admin — JavaScript principal
//  Gère : authentification, navigation, appels API, UI
// ============================================================

'use strict';

// ── Configuration ────────────────────────────────────────────
const CONFIG = {
  API_URL:      'https://hax-back.onrender.com',
  ADMIN_KEY:    'haxfinance2025',  // Doit correspondre à .env ADMIN_KEY
  SESSION_KEY:  'hax_admin_session',
  PAGE_SIZE:    12,
};

// ── État global de l'application ─────────────────────────────
const ETAT = {
  page:          1,
  totalPages:    1,
  total:         0,
  filtreStatut:  '',
  filtreType:    '',
  recherche:     '',
  triChamp:      'createdAt',
  triOrdre:      -1,            // -1 = décroissant (récent d'abord)
  demandeActive: null,
  stats:         null,
};

// ── Utilitaires ──────────────────────────────────────────────

/** Formate un montant en euros */
const fmt = (n) => n ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n) : '—';

/** Formate une date */
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}) : '—';

/** Date courte (sans heure) */
const fmtDateCourte = (d) => d ? new Date(d).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—';

/** Labels des statuts */
const LABELS_STATUT = {
  en_attente: 'En attente',
  en_cours:   'En cours',
  approuve:   'Approuvé',
  refuse:     'Refusé',
  annule:     'Annulé',
};

/** Labels des types de prêt */
const LABELS_TYPE = {
  personnel:  '💳 Personnel',
  immobilier: '🏠 Immobilier',
  automobile: '🚗 Automobile',
  rachat:     '🔄 Rachat',
};

/** Labels des situations pro */
const LABELS_SITUATION = {
  'salarie-cdi': 'Salarié CDI',
  'salarie-cdd': 'Salarié CDD',
  'independant': 'Indépendant',
  'retraite':    'Retraité',
  'etudiant':    'Étudiant',
  'autre':       'Autre',
};

// ════════════════════════════════════════════════════════════════
//  AUTH — Gestion de la session admin
// ════════════════════════════════════════════════════════════════

/** Vérifie si l'admin est connecté (clé en sessionStorage) */
function estConnecte() {
  return sessionStorage.getItem(CONFIG.SESSION_KEY) === CONFIG.ADMIN_KEY;
}

/** Redirige vers la page login si non connecté */
function verifierAuth() {
  if (!estConnecte()) {
    window.location.href = 'login.html';
  }
}

/** Sauvegarde la session (côté client uniquement — voir note sécurité) */
function sauverSession(cle) {
  sessionStorage.setItem(CONFIG.SESSION_KEY, cle);
}

/** Déconnexion */
function deconnecter() {
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  window.location.href = 'login.html';
}

// ════════════════════════════════════════════════════════════════
//  API — Appels vers le backend Node.js
// ════════════════════════════════════════════════════════════════

/**
 * Fonction générique pour appeler l'API backend.
 * Ajoute automatiquement l'en-tête d'authentification.
 */
async function appelAPI(endpoint, options = {}) {
  const url = `${CONFIG.API_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': CONFIG.ADMIN_KEY,   // Authentification par API key
      ...(options.headers || {}),
    },
  };
  const reponse = await fetch(url, config);
  const json    = await reponse.json();

  if (!reponse.ok) throw Object.assign(new Error(json.message || 'Erreur API'), { status: reponse.status, data: json });
  return json;
}

/** Charge les statistiques du tableau de bord */
async function chargerStats() {
  return appelAPI('/api/admin/stats');
}

/** Charge la liste des demandes avec filtres et pagination */
async function chargerDemandes(params = {}) {
  const qs = new URLSearchParams({
    page:    params.page    || ETAT.page,
    limit:   CONFIG.PAGE_SIZE,
    statut:  params.statut  ?? ETAT.filtreStatut,
    type:    params.type    ?? ETAT.filtreType,
    search:  params.search  ?? ETAT.recherche,
    sort:    params.sort    ?? ETAT.triChamp,
    order:   params.order   ?? ETAT.triOrdre,
  });
  // Supprimer les params vides
  [...qs.entries()].forEach(([k, v]) => { if (!v && v !== 0) qs.delete(k); });
  return appelAPI(`/api/admin/demandes?${qs}`);
}

/** Charge une demande unique par référence */
async function chargerDemande(reference) {
  return appelAPI(`/api/admin/demande/${reference}`);
}

/** Met à jour le statut + notes d'une demande */
async function mettreAJourDemande(reference, statut, notes) {
  return appelAPI(`/api/loan-request/${reference}/statut`, {
    method: 'PATCH',
    body:   JSON.stringify({ statut, notes }),
  });
}

/** Exporte les demandes filtrées en CSV */
async function exporterCSV() {
  const json = await chargerDemandes({ page: 1, limit: 9999 });
  const demandes = json.data?.demandes || [];
  if (!demandes.length) { afficherToast('Aucune demande à exporter', '', true); return; }

  const entetes = ['Référence', 'Date', 'Prénom', 'Nom', 'Email', 'Téléphone',
    'Type prêt', 'Montant (€)', 'Durée (mois)', 'Mensualité (€)', 'Revenus (€)',
    'Situation', 'Statut', 'Notes'];

  const lignes = demandes.map(d => [
    d.reference,
    fmtDateCourte(d.createdAt),
    d.client?.prenom || '',
    d.client?.nom    || '',
    d.client?.email  || '',
    d.client?.telephone || '',
    d.pret?.typePret || '',
    d.pret?.montant  || 0,
    d.pret?.duree    || 0,
    d.pret?.mensualiteEstimee || 0,
    d.pret?.revenusMensuels   || 0,
    d.client?.situationPro || '',
    d.statut || '',
    (d.notesConseiller || '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','));

  const csv = [entetes.join(','), ...lignes].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = `haxfinance-demandes-${new Date().toISOString().split('T')[0]}.csv`;
  lien.click();
  afficherToast('Export réussi', `${demandes.length} demandes exportées`);
}

// ════════════════════════════════════════════════════════════════
//  TOAST — Notifications visuelles
// ════════════════════════════════════════════════════════════════
function afficherToast(titre, sous = '', erreur = false) {
  const toast = document.getElementById('toast-admin');
  if (!toast) return;

  toast.querySelector('.t-icone').textContent = erreur ? '❌' : '✅';
  toast.querySelector('strong').textContent   = titre;
  toast.querySelector('span').textContent     = sous;
  toast.classList.toggle('erreur', erreur);
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// ════════════════════════════════════════════════════════════════
//  PANNEAU DÉTAIL — Affichage d'une demande
// ════════════════════════════════════════════════════════════════
function ouvrirPanneau(demande) {
  ETAT.demandeActive = demande;
  const panneau = document.getElementById('panneau-detail');
  const overlay = document.getElementById('overlay');
  if (!panneau || !overlay) return;

  // Remplir les données
  remplirPanneau(demande);

  panneau.classList.add('ouvert');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function fermerPanneau() {
  const panneau = document.getElementById('panneau-detail');
  const overlay = document.getElementById('overlay');
  panneau?.classList.remove('ouvert');
  overlay?.classList.remove('visible');
  document.body.style.overflow = '';
  ETAT.demandeActive = null;
}

function remplirPanneau(d) {
  // En-tête
  const refEl = document.getElementById('panneau-ref');
  const titreEl = document.getElementById('panneau-titre');
  if (refEl)   refEl.textContent   = d.reference;
  if (titreEl) titreEl.textContent = `${d.client?.prenom} ${d.client?.nom}`;

  // Fonction helper pour mettre à jour un élément
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Informations client
  set('d-nom',       `${d.client?.prenom} ${d.client?.nom}`);
  set('d-email',     `<a href="mailto:${d.client?.email}" style="color:var(--vert)">${d.client?.email}</a>`);
  set('d-tel',       `<a href="tel:${d.client?.telephone}" style="color:var(--vert)">${d.client?.telephone}</a>`);
  setTxt('d-situation', LABELS_SITUATION[d.client?.situationPro] || d.client?.situationPro || '—');
  setTxt('d-date',      fmtDate(d.createdAt));

  // Détails prêt
  set('d-type',          `<span class="badge-type">${LABELS_TYPE[d.pret?.typePret] || d.pret?.typePret}</span>`);
  set('d-montant',       `<span class="detail-valeur montant">${fmt(d.pret?.montant)}</span>`);
  setTxt('d-duree',      `${d.pret?.duree} mois (${(d.pret?.duree/12).toFixed(1)} ans)`);
  setTxt('d-mensualite', fmt(d.pret?.mensualiteEstimee));
  setTxt('d-taux',       `${d.pret?.tauxAnnuel?.toFixed(1)}%`);
  setTxt('d-revenus',    d.pret?.revenusMensuels ? fmt(d.pret.revenusMensuels) : '—');

  // Taux d'endettement
  const tauxEl = document.getElementById('d-endettement');
  if (tauxEl && d.pret?.revenusMensuels > 0) {
    const te = ((d.pret.mensualiteEstimee / d.pret.revenusMensuels) * 100).toFixed(1);
    const couleur = parseFloat(te) > 33 ? 'var(--rouge)' : 'var(--vert)';
    tauxEl.innerHTML = `<span style="color:${couleur};font-weight:700;">${te}%</span>`;
  } else if (tauxEl) { tauxEl.textContent = '—'; }

  // Message client
  const msgEl = document.getElementById('d-message');
  if (msgEl) {
    msgEl.closest('.detail-section').style.display = d.client?.message ? '' : 'none';
    msgEl.textContent = d.client?.message || '';
  }

  // Statut actuel
  const selectStatut = document.getElementById('select-statut');
  if (selectStatut) selectStatut.value = d.statut || 'en_attente';

  // Notes conseiller
  const notesEl = document.getElementById('notes-conseiller');
  if (notesEl) notesEl.value = d.notesConseiller || '';

  // Coût total
  const cout = (d.pret?.mensualiteEstimee || 0) * (d.pret?.duree || 0);
  const interets = cout - (d.pret?.montant || 0);
  setTxt('d-cout-total', fmt(cout));
  setTxt('d-interets',   fmt(Math.max(0, interets)));
}

// ════════════════════════════════════════════════════════════════
//  TABLE — Rendu de la liste des demandes
// ════════════════════════════════════════════════════════════════
function rendreTableau(demandes) {
  const tbody = document.getElementById('tbody-demandes');
  if (!tbody) return;

  if (!demandes.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="etat-vide">
        <div class="emoji">📭</div>
        <p>Aucune demande trouvée pour ces critères.</p>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = demandes.map(d => `
    <tr data-ref="${d.reference}" onclick="ouvrirDemandeParRef('${d.reference}')">
      <td class="checkbox-td" onclick="event.stopPropagation()">
        <input type="checkbox" class="cb-demande" data-ref="${d.reference}" />
      </td>
      <td class="ref">${d.reference}</td>
      <td class="nom">${d.client?.prenom} ${d.client?.nom}</td>
      <td>
        <span class="badge-type">${LABELS_TYPE[d.pret?.typePret] || d.pret?.typePret}</span>
      </td>
      <td class="montant">${fmt(d.pret?.montant)}</td>
      <td>${fmtDateCourte(d.createdAt)}</td>
      <td>
        <span class="badge-statut ${d.statut}">${LABELS_STATUT[d.statut] || d.statut}</span>
      </td>
      <td>
        <button class="btn-action" onclick="event.stopPropagation();ouvrirDemandeParRef('${d.reference}')">
          Voir ›
        </button>
      </td>
    </tr>
  `).join('');
}

async function ouvrirDemandeParRef(reference) {
  try {
    const json = await chargerDemande(reference);
    ouvrirPanneau(json.data);
  } catch (e) {
    afficherToast('Erreur de chargement', e.message, true);
  }
}

// ════════════════════════════════════════════════════════════════
//  PAGINATION
// ════════════════════════════════════════════════════════════════
function rendrePagination() {
  const infoEl  = document.getElementById('pagination-info');
  const btnsEl  = document.getElementById('pagination-btns');
  if (!infoEl || !btnsEl) return;

  const debut = (ETAT.page - 1) * CONFIG.PAGE_SIZE + 1;
  const fin   = Math.min(ETAT.page * CONFIG.PAGE_SIZE, ETAT.total);
  infoEl.textContent = ETAT.total > 0
    ? `Affichage ${debut}–${fin} sur ${ETAT.total} demandes`
    : 'Aucune demande';

  // Boutons de pages
  const btns = [];
  btns.push(`<button class="btn-page" onclick="allerPage(${ETAT.page-1})" ${ETAT.page <= 1 ? 'disabled' : ''}>← Préc.</button>`);

  // Numéros de pages (max 5 affichés)
  const debut2 = Math.max(1, ETAT.page - 2);
  const fin2   = Math.min(ETAT.totalPages, ETAT.page + 2);
  for (let p = debut2; p <= fin2; p++) {
    btns.push(`<button class="btn-page ${p === ETAT.page ? 'actif' : ''}" onclick="allerPage(${p})">${p}</button>`);
  }

  btns.push(`<button class="btn-page" onclick="allerPage(${ETAT.page+1})" ${ETAT.page >= ETAT.totalPages ? 'disabled' : ''}>Suiv. →</button>`);
  btnsEl.innerHTML = btns.join('');
}

async function allerPage(n) {
  if (n < 1 || n > ETAT.totalPages) return;
  ETAT.page = n;
  await rafraichirListe();
  document.getElementById('tableau-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ════════════════════════════════════════════════════════════════
//  CHARGEMENT PRINCIPAL
// ════════════════════════════════════════════════════════════════
async function rafraichirListe() {
  afficherSkeletonTableau();
  try {
    const json = await chargerDemandes();
    const { demandes, pagination } = json.data;
    ETAT.total      = pagination.total;
    ETAT.totalPages = pagination.pages;

    rendreTableau(demandes);
    rendrePagination();
    mettreAJourCompteurStatut();
  } catch (e) {
    afficherToast('Erreur de chargement', e.message, true);
    const tbody = document.getElementById('tbody-demandes');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="etat-vide"><div class="emoji">⚠️</div><p>Impossible de charger les demandes. Vérifiez que le serveur tourne.</p></td></tr>`;
  }
}

function afficherSkeletonTableau() {
  const tbody = document.getElementById('tbody-demandes');
  if (!tbody) return;
  tbody.innerHTML = Array(5).fill(0).map(() => `
    <tr>
      <td class="checkbox-td"></td>
      ${Array(7).fill('<td><div class="skeleton sk-line" style="width:80%"></div></td>').join('')}
    </tr>`).join('');
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD — Stats et graphiques
// ════════════════════════════════════════════════════════════════
async function chargerDashboard() {
  afficherSkeletonsStats();
  try {
    const json = await chargerStats();
    ETAT.stats = json.data;
    rendreDashboard(json.data);
  } catch (e) {
    afficherToast('Erreur stats', e.message, true);
  }
}

function afficherSkeletonsStats() {
  document.querySelectorAll('.stat-valeur').forEach(el => {
    el.innerHTML = '<div class="skeleton sk-line" style="width:60%;height:24px"></div>';
  });
}

function rendreDashboard(data) {
  const global = data.global?.[0] || {};
  const parStatut = data.parStatut || [];
  const parType   = data.parType   || [];

  // Totaux globaux
  setTxt('stat-total',          global.total          || 0);
  setTxt('stat-montant-total',  fmt(global.montantTotal));
  setTxt('stat-montant-moyen',  fmt(global.montantMoyen));

  // En attente
  const nbAttente = parStatut.find(s => s._id === 'en_attente')?.count || 0;
  setTxt('stat-en-attente', nbAttente);

  // Approuvés
  const nbApprouves = parStatut.find(s => s._id === 'approuve')?.count || 0;
  setTxt('stat-approuves', nbApprouves);

  // Taux d'approbation
  const total = global.total || 1;
  const tauxAppro = ((nbApprouves / total) * 100).toFixed(0);
  setTxt('stat-taux-approbation', tauxAppro + '%');

  // Graphiques par statut
  rendreGrapheStatuts(parStatut, total);

  // Répartition par type
  rendreRepartitionTypes(parType, total);

  // Badge navbar en attente
  const badgeEl = document.getElementById('badge-en-attente');
  if (badgeEl) { badgeEl.textContent = nbAttente; badgeEl.style.display = nbAttente > 0 ? '' : 'none'; }
}

function rendreGrapheStatuts(parStatut, total) {
  const conteneur = document.getElementById('graphe-statuts');
  if (!conteneur) return;

  const couleurs = { en_attente: '#F0B429', en_cours: '#93C5FD', approuve: '#00C896', refuse: '#EF4444', annule: '#8A9BC0' };
  const labels   = LABELS_STATUT;
  const tous = ['en_attente', 'en_cours', 'approuve', 'refuse', 'annule'];

  conteneur.innerHTML = tous.map(statut => {
    const n   = parStatut.find(s => s._id === statut)?.count || 0;
    const pct = total > 0 ? ((n / total) * 100).toFixed(0) : 0;
    return `
      <div class="repart-item">
        <div class="repart-label">
          <span>${labels[statut]}</span>
          <span>${n} (${pct}%)</span>
        </div>
        <div class="repart-barre-bg">
          <div class="repart-barre" style="width:${pct}%;background:${couleurs[statut]}"></div>
        </div>
      </div>`;
  }).join('');
}

function rendreRepartitionTypes(parType, total) {
  const conteneur = document.getElementById('graphe-types');
  if (!conteneur) return;

  const couleurs = { personnel:'#00C896', immobilier:'#93C5FD', automobile:'#F0B429', rachat:'#8B5CF6' };
  const types    = ['personnel', 'immobilier', 'automobile', 'rachat'];

  conteneur.innerHTML = types.map(type => {
    const item = parType.find(t => t._id === type);
    const n    = item?.count || 0;
    const pct  = total > 0 ? ((n / total) * 100).toFixed(0) : 0;
    return `
      <div class="repart-item">
        <div class="repart-label">
          <span>${LABELS_TYPE[type]}</span>
          <span>${n} dossier${n>1?'s':''} · ${fmt(item?.montantTotal || 0)}</span>
        </div>
        <div class="repart-barre-bg">
          <div class="repart-barre" style="width:${pct}%;background:${couleurs[type]}"></div>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  SAUVEGARDER LES MODIFICATIONS D'UNE DEMANDE
// ════════════════════════════════════════════════════════════════
async function sauverDemande() {
  const ref     = ETAT.demandeActive?.reference;
  const statut  = document.getElementById('select-statut')?.value;
  const notes   = document.getElementById('notes-conseiller')?.value;
  if (!ref || !statut) return;

  const btnSauver = document.getElementById('btn-sauver');
  if (btnSauver) { btnSauver.textContent = '⏳ Sauvegarde…'; btnSauver.disabled = true; }

  try {
    await mettreAJourDemande(ref, statut, notes);
    afficherToast('Demande mise à jour', `Statut : ${LABELS_STATUT[statut]}`);
    fermerPanneau();
    // Rafraîchir le tableau ET les stats
    await Promise.all([rafraichirListe(), chargerDashboard()]);
  } catch (e) {
    afficherToast('Erreur de sauvegarde', e.message, true);
  } finally {
    if (btnSauver) { btnSauver.textContent = 'Sauvegarder'; btnSauver.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════════════
//  FILTRES ET RECHERCHE
// ════════════════════════════════════════════════════════════════
let timerRecherche = null;

function initialiserFiltres() {
  // Recherche avec debounce (attend 350ms avant de chercher)
  const inputRecherche = document.getElementById('input-recherche');
  if (inputRecherche) {
    inputRecherche.addEventListener('input', (e) => {
      clearTimeout(timerRecherche);
      timerRecherche = setTimeout(() => {
        ETAT.recherche = e.target.value.trim();
        ETAT.page = 1;
        rafraichirListe();
      }, 350);
    });
  }

  // Filtre statut
  const selectStatutFiltre = document.getElementById('filtre-statut');
  if (selectStatutFiltre) {
    selectStatutFiltre.addEventListener('change', (e) => {
      ETAT.filtreStatut = e.target.value;
      ETAT.page = 1;
      rafraichirListe();
    });
  }

  // Filtre type
  const selectTypeFiltre = document.getElementById('filtre-type');
  if (selectTypeFiltre) {
    selectTypeFiltre.addEventListener('change', (e) => {
      ETAT.filtreType = e.target.value;
      ETAT.page = 1;
      rafraichirListe();
    });
  }
}

// ════════════════════════════════════════════════════════════════
//  SIDEBAR MOBILE
// ════════════════════════════════════════════════════════════════
function initialiserSidebar() {
  const burger  = document.getElementById('burger-admin');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('overlay-sidebar');

  if (burger && sidebar) {
    burger.addEventListener('click', () => sidebar.classList.toggle('ouverte'));
  }
  if (overlay) {
    overlay.addEventListener('click', () => sidebar?.classList.remove('ouverte'));
  }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

function mettreAJourCompteurStatut() {
  // Mettre à jour le badge "En attente" dans la sidebar
  // Il sera recalculé après le prochain chargement des stats
}

// Exposer les fonctions nécessaires globalement
window.ouvrirDemandeParRef = ouvrirDemandeParRef;
window.fermerPanneau       = fermerPanneau;
window.sauverDemande       = sauverDemande;
window.allerPage           = allerPage;
window.exporterCSV         = exporterCSV;
window.deconnecter         = deconnecter;
window.ETAT                = ETAT;
window.rafraichirListe     = rafraichirListe;
window.chargerDashboard    = chargerDashboard;
window.initialiserFiltres  = initialiserFiltres;
window.initialiserSidebar  = initialiserSidebar;
window.afficherToast       = afficherToast;
window.estConnecte         = estConnecte;
window.verifierAuth        = verifierAuth;
window.sauverSession       = sauverSession;
window.CONFIG              = CONFIG;
window.fmt                 = fmt;
window.fmtDate             = fmtDate;
