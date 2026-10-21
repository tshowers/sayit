/* Sun/moon switch for the static pages (/, /about, /help). Same storage key and
   behavior as the app's ThemeService: follows the system until the visitor picks,
   then remembers the pick. The <head> script sets data-theme before paint. */
(function () {
  var KEY = 'sayit-theme';
  var COLORS = { light: '#ffffff', dark: '#0c0e13' };
  var SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.7 14.6A8.5 8.5 0 0 1 9.4 3.3 8.5 8.5 0 1 0 20.7 14.6Z"/></svg>';
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-theme-toggle]');

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-bs-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
    var dark = theme === 'dark';
    var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].innerHTML = dark ? SUN : MOON;
      buttons[i].setAttribute('aria-label', label);
      buttons[i].setAttribute('title', label);
      buttons[i].setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) { }
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
      if (stored()) return; // an explicit pick wins over the system
      apply(event.matches ? 'dark' : 'light');
    });
  }

  apply(current());
})();
