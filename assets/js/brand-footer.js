(() => {
  const stylesheetId = 'jw-brand-footer-styles';
  if (!document.getElementById(stylesheetId)) {
    const stylesheet = document.createElement('link');
    stylesheet.id = stylesheetId;
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/css/brand-footer.css';
    document.head.appendChild(stylesheet);
  }

  const existing = document.getElementById('global-footer');
  const footer = document.createElement('footer');
  footer.id = 'jw-brand-footer';
  footer.className = 'jw-brand-footer';
  footer.innerHTML = `
    <div class="jwbf-container">
      <div class="jwbf-compliance">
        <div class="jwbf-identity">
          <a class="jwbf-wordmark" href="https://www.jwillsoldit.com/" aria-label="JWILLSOLDIT home">
            JWILLSOLDIT<span class="jwbf-dot">.</span>
          </a>
          <span class="jwbf-id">Joey Williams &middot; REALTOR&reg; &middot; Christin Rachelle Group &middot; Houston, TX</span>
        </div>
        <nav class="jwbf-links" aria-label="Compliance and legal">
          <a href="https://www.jwillsoldit.com/assets/iabs.pdf">IABS</a>
          <a href="https://www.jwillsoldit.com/assets/cpn.pdf">Consumer Protection Notice</a>
          <a href="https://www.jwillsoldit.com/privacy.html">Privacy</a>
          <a href="https://www.jwillsoldit.com/houston">Houston Guides</a>
          <a href="https://move.jwillsoldit.com/">Smart Move</a>
        </nav>
      </div>
      <div class="jwbf-bottom">
        <div class="jwbf-logo-frame">
          <img class="jwbf-logo" src="/assets/crg-logo-transparent.png" alt="Christin Rachelle Group" loading="lazy">
        </div>
        <p class="jwbf-fineprint">
          Equal Housing Opportunity. Texas Real Estate Commission notices linked above:
          Information About Brokerage Services &amp; Consumer Protection Notice.
          &copy; ${new Date().getFullYear()} JWILLSOLDIT.
        </p>
      </div>
    </div>`;

  if (existing) {
    existing.replaceWith(footer);
  } else {
    document.body.appendChild(footer);
  }
})();
