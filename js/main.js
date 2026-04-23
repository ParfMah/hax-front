/* ============================================================
   HaxFinance — JavaScript principal
   - Loader de page
   - Navigation sticky + menu burger
   - Animations d'entrée (Intersection Observer)
   ============================================================ */

/* ── 1. LOADER DE PAGE ──────────────────────────────────── */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  // On laisse la barre se remplir (1.6s dans CSS), puis on cache
  setTimeout(() => {
    loader.classList.add('hide');
  }, 1800);
});

/* ── 2. NAVIGATION STICKY ───────────────────────────────── */
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* ── 3. MENU BURGER (mobile) ────────────────────────────── */
const burger      = document.querySelector('.burger');
const navMobile   = document.querySelector('.nav-mobile');

if (burger && navMobile) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('ouvert');
    navMobile.classList.toggle('ouvert');
  });

  // Fermer le menu si on clique sur un lien
  navMobile.querySelectorAll('a').forEach(lien => {
    lien.addEventListener('click', () => {
      burger.classList.remove('ouvert');
      navMobile.classList.remove('ouvert');
    });
  });
}

/* ── 4. LIEN ACTIF DANS LA NAVIGATION ──────────────────── */
(function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(lien => {
    const href = lien.getAttribute('href').split('/').pop();
    if (href === page) lien.classList.add('actif');
  });
})();

/* ── 5. ANIMATIONS D'ENTRÉE (Intersection Observer) ─────── */
const observerOptions = {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target); // On n'anime qu'une fois
    }
  });
}, observerOptions);

// Observer tous les éléments avec la classe fade-in
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

/* ── 6. COMPTEURS ANIMÉS (section stats) ────────────────── */
function animerCompteur(el) {
  const cible   = parseFloat(el.getAttribute('data-cible'));
  const suffixe = el.getAttribute('data-suffixe') || '';
  const duree   = 1800; // ms
  const pas     = 16;   // ~60fps
  const increment = cible / (duree / pas);
  let valeur = 0;

  const timer = setInterval(() => {
    valeur += increment;
    if (valeur >= cible) {
      valeur = cible;
      clearInterval(timer);
    }
    // Affichage : entier ou décimal selon le type
    el.textContent = Number.isInteger(cible)
      ? Math.floor(valeur).toLocaleString('fr-FR') + suffixe
      : valeur.toFixed(1) + suffixe;
  }, pas);
}

// Observer les compteurs
const compteurObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animerCompteur(entry.target);
      compteurObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-cible]').forEach(el => compteurObserver.observe(el));