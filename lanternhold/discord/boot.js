// Lanternhold as a Discord Activity (v133 private test, John 26 Nov 2026).
// index.html loads this file (and sdk.js, Discord's Embedded App SDK 2.5.0, MIT) only when the page runs inside Discord's
// Activity frame (*.discordsays.com), or on localhost with ?discord=mock for tests. The website itself never loads it.
// Inside Discord every request goes through Discord's proxy and its CSP blocks any host that is not mapped in the
// developer portal (Activities > URL Mappings), so:
//   /            -> lanternhold.born2gamellc.com
//   /lh-api      -> nyu3u8gc73.execute-api.us-east-1.amazonaws.com
//   /lh-cognito  -> cognito-idp.us-east-1.amazonaws.com
//   /lh-war      -> war.born2gamellc.com   (alliance art; ui.js WAR_IMG points there inside Discord)
// patchUrlMappings rewrites fetch/XHR/WebSocket calls to those hosts onto the proxy paths. Fonts are served from
// discord/fonts (Google Fonts would need two more mappings and <link> tags are not rewritten). Outside links go through
// Discord's openExternalLink, which asks the player before leaving Discord.
(function () {
  var CLIENT_ID = '1575569010945425418';
  var SITE = 'https://lanternhold.born2gamellc.com/';
  var MAPS = [
    { prefix: '/lh-api', target: 'nyu3u8gc73.execute-api.us-east-1.amazonaws.com' },
    { prefix: '/lh-cognito', target: 'cognito-idp.us-east-1.amazonaws.com' },
    { prefix: '/lh-war', target: 'war.born2gamellc.com' },
  ];
  var mock = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]discord=mock\b/.test(location.search);
  var DC = window.LH_DISCORD = { clientId: CLIENT_ID, mock: mock, sdk: null, ready: null, user: null };

  // Fonts the game expects, served from our own files.
  var css = document.createElement('style');
  css.textContent = [['Chakra Petch', 500, 'chakra-500'], ['Chakra Petch', 600, 'chakra-600'], ['Chakra Petch', 700, 'chakra-700'], ['Inter', '400 800', 'inter']]
    .map(function (f) { return "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + f[1] + ";font-display:swap;src:url(discord/fonts/" + f[2] + ".woff2) format('woff2')}"; }).join('');
  document.head.appendChild(css);
  document.documentElement.classList.add('indiscord');
  // Where players came from (admin Players view): count Activity players apart from website visitors.
  try { var rf = localStorage.getItem('lh_ref'); if (!rf || rf === 'discord') localStorage.setItem('lh_ref', 'discord-act'); } catch (e) {}

  if (mock) {
    // A stand-in for local tests: no proxy, no Discord. authorize() returns a fake code that a test stubs on /discord/login.
    var calls = window.LH_DISCORD_CALLS = [];
    DC.sdk = { commands: {
      authorize: function (o) { calls.push(['authorize', o]); return Promise.resolve({ code: 'mock-code' }); },
      authenticate: function (o) { calls.push(['authenticate', o]); return Promise.resolve({ user: { id: '1', username: 'mock' } }); },
      openExternalLink: function (o) { calls.push(['openExternalLink', o.url]); return Promise.resolve({ opened: true }); },
    } };
    DC.ready = Promise.resolve();
  } else {
    var X = window.LHDiscordSDK;
    X.patchUrlMappings(MAPS);
    DC.sdk = new X.DiscordSDK(CLIENT_ID);
    DC.ready = DC.sdk.ready();
  }

  // Open an outside page through Discord. Relative links (privacy.html, wiki/) point at the live website.
  DC.open = function (url) {
    var u; try { u = new URL(url, SITE); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    DC.ready.then(function () { return DC.sdk.commands.openExternalLink({ url: u.href }); }).catch(function () {});
  };
  var plainOpen = window.open;
  window.open = function (url) {
    if (url && !/^(javascript|about):/i.test(String(url))) { DC.open(String(url)); return null; }
    return plainOpen.apply(window, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(javascript|mailto):/i.test(href)) return;
    var u; try { u = new URL(href, location.href); } catch (x) { return; }
    // Inside the frame only the game page itself can load; everything else opens outside Discord.
    if (u.origin === location.origin && a.target !== '_blank' && /\/(index\.html)?$/.test(u.pathname)) return;
    e.preventDefault();
    DC.open(u.origin === location.origin ? u.pathname.replace(/^\//, '') + u.search + u.hash : u.href);
  }, true);
})();
