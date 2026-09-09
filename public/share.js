(() => {
  const canonicalUrl = () => window.location.href.split('#')[0];
  const shareText = 'Brooklyn Asks: search what Brooklyn Community Boards asked the city for, how agencies responded, and which requests keep coming back.';

  function setLinks() {
    const url = encodeURIComponent(canonicalUrl());
    const text = encodeURIComponent(shareText);
    const title = encodeURIComponent('Brooklyn Asks');
    const map = {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      email: `mailto:?subject=${title}&body=${text}%0A%0A${url}`
    };
    Object.entries(map).forEach(([key, href]) => {
      const el = document.querySelector(`[data-share="${key}"]`);
      if (el) el.href = href;
    });
  }

  function status(message) {
    const el = document.querySelector('#shareStatus');
    if (!el) return;
    el.textContent = message;
    window.setTimeout(() => { el.textContent = ''; }, 2200);
  }

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-share]');
    if (!target) return;
    const type = target.dataset.share;
    if (type === 'copy') {
      event.preventDefault();
      try {
        await navigator.clipboard.writeText(canonicalUrl());
        status('Link copied.');
      } catch {
        window.prompt('Copy this link:', canonicalUrl());
      }
    }
    if (type === 'native') {
      event.preventDefault();
      if (navigator.share) {
        try { await navigator.share({ title: 'Brooklyn Asks', text: shareText, url: canonicalUrl() }); }
        catch (err) { if (err?.name !== 'AbortError') status('Share unavailable.'); }
      } else {
        try { await navigator.clipboard.writeText(canonicalUrl()); status('Link copied.'); }
        catch { window.prompt('Copy this link:', canonicalUrl()); }
      }
    }
  });

  setLinks();
})();
