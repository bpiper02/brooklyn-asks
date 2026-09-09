(() => {
  const iconMap = new Map([
    ['◆','🚇'],
    ['⌂','🏠'],
    ['✦','🌳'],
    ['▣','🏫'],
    ['●','🚨'],
    ['+','✚'],
    ['▤','🌉'],
    ['↔','♿'],
    ['◇','🤝']
  ]);

  function translateGlyphs(root=document) {
    root.querySelectorAll('.category-legend i, .category-glyph').forEach(el => {
      const key = (el.textContent || '').trim();
      if (iconMap.has(key)) el.textContent = iconMap.get(key);
    });
  }

  function cleanMapCopy() {
    const label = document.querySelector('#mapColorBy')?.previousElementSibling;
    if (label) label.textContent = 'SHOW ME';
    const mapSelect = document.querySelector('#mapColorBy');
    if (mapSelect) {
      const labels = {
        volume:'Most issues raised',
        recurring:'Most issues that came back',
        uncertain:'Most issues with unclear funding'
      };
      [...mapSelect.options].forEach(o => { if (labels[o.value]) o.textContent = labels[o.value]; });
    }
    const metric = document.querySelector('#legendMetric');
    if (metric) {
      const v = mapSelect?.value;
      metric.textContent = v === 'recurring' ? 'ISSUES THAT CAME BACK' : v === 'uncertain' ? 'UNCLEAR FUNDING' : 'ISSUES RAISED';
    }
  }

  function openMapFirst() {
    const mapButton = [...document.querySelectorAll('.nav-tab')].find(b => b.dataset.view === 'map');
    if (mapButton && !mapButton.classList.contains('is-active')) mapButton.click();
  }

  const observer = new MutationObserver(() => {
    translateGlyphs();
    cleanMapCopy();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  window.addEventListener('load', () => {
    openMapFirst();
    translateGlyphs();
    cleanMapCopy();
  });
})();
