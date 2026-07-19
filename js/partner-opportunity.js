(function () {
  'use strict';

  var previousBodyOverflow = '';

  function elements() {
    return {
      overlay: document.getElementById('tt-partner-opportunity-overlay'),
      sheet: document.getElementById('tt-partner-opportunity-sheet'),
      image: document.getElementById('tt-partner-opportunity-image')
    };
  }

  function openPartnerOpportunity() {
    var ui = elements();
    if (!ui.overlay || !ui.sheet) return;

    if (typeof window.closeWishlist === 'function') window.closeWishlist();
    if (typeof window.closeBasket === 'function') window.closeBasket();

    if (ui.image && !ui.image.getAttribute('src')) {
      ui.image.setAttribute('src', ui.image.dataset.src);
    }

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ui.sheet.setAttribute('aria-hidden', 'false');
    ui.overlay.classList.add('open');
    ui.sheet.classList.add('open');

    window.requestAnimationFrame(function () {
      var closeButton = ui.sheet.querySelector('.tt-partner-opportunity-close');
      if (closeButton) closeButton.focus();
    });
  }

  function closePartnerOpportunity() {
    var ui = elements();
    if (ui.overlay) ui.overlay.classList.remove('open');
    if (ui.sheet) {
      ui.sheet.classList.remove('open');
      ui.sheet.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = previousBodyOverflow;
  }

  function partnerOpportunityOverlayClick(event) {
    if (event.target && event.target.id === 'tt-partner-opportunity-overlay') {
      closePartnerOpportunity();
    }
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closePartnerOpportunity();
  });

  window.openPartnerOpportunity = openPartnerOpportunity;
  window.closePartnerOpportunity = closePartnerOpportunity;
  window.partnerOpportunityOverlayClick = partnerOpportunityOverlayClick;
})();
