// Inject a shared nav into pages. This works both when served (fetch) and when opened locally (file://)
document.addEventListener('DOMContentLoaded', async () => {
    const template = `
<nav class="navbar">
    <div class="nav-brand">Jesse Angrist</div>
    <ul class="nav-links">
        <li><a data-root-href="index.html" class="nav-home">Home</a></li>
        <li class="projects-dropdown">
            <a data-root-href="index.html#projects" class="dropdown-toggle">Projects ▾</a>
            <ul class="dropdown-menu">
                <li><a data-root-href="projects/MAE573.html">Transcontinental Transmission and System Impacts</a></li>
                <li><a data-root-href="projects/SPI306.html">Economics of Agrivoltaic Microgrids in Developing Nations</a></li>
                <li><a data-root-href="projects/MAE422.html">Regulatory and Decarbonization Study of German Electricity System</a></li>
            </ul>
        </li>
        <li class="personal-dropdown">
            <a data-root-href="index.html#personal" class="dropdown-toggle">Personal ▾</a>
            <ul class="dropdown-menu">
                <li><a data-root-href="personal/princeton.html">Princeton University Energy Association</a></li>
                <li><a data-root-href="personal/guitar.html">Guitar</a></li>
                <li><a data-root-href="personal/dance.html">Dance</a></li>
            </ul>
        </li>
    </ul>
</nav>
`;

    // Try to fetch nav.html when available (hosted). If fetch fails (file://), fall back to template.
    let html = null;
    try {
        const res = await fetch('nav.html', {cache: 'no-store'});
        if (res.ok) {
            html = await res.text();
        }
    } catch (e) {
        // ignore — fallback to embedded template
    }

    if (!html) html = template;

    const container = document.createElement('div');
    container.innerHTML = html;
    const navEl = container.firstElementChild;
    if (!navEl) return;

    // Insert at top of body
    document.body.insertBefore(navEl, document.body.firstChild);

    // Rewrite hrefs so they resolve correctly from root, projects/, and personal/ pages.
    const anchors = document.querySelectorAll('.nav-links a');
    const path = window.location.pathname || '';
    const currentFolder = path.includes('/projects/') ? 'projects' : (path.includes('/personal/') ? 'personal' : null);

    function makeHref(raw) {
        if (!raw) return raw;
        // leave absolute URLs intact
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
        // strip leading slash
        let href = raw.replace(/^\//, '');
        // If link points to same folder, use basename (e.g., projects/MAE422.html -> MAE422.html)
        if (currentFolder && href.startsWith(currentFolder + '/')) {
            return href.split('/').pop();
        }
        // If we're in a subfolder, prefix with ../ to reach root for other links
        if (currentFolder) return '../' + href;
        // otherwise, we're at root, href is fine
        return href;
    }

    anchors.forEach(a => {
        const dr = a.getAttribute('data-root-href');
        const existing = a.getAttribute('href');
        const raw = dr || existing || '';
        const newHref = makeHref(raw);
        try {
            // set the resolved absolute URL on the anchor element (works for file:// and http://)
            a.href = new URL(newHref, window.location.href).href;
        } catch (err) {
            a.setAttribute('href', newHref);
        }
    });

    // Debug: log resolved links and dropdown toggles
    console.debug('Injected nav links:');
    anchors.forEach(a => console.debug('nav link ->', a.textContent.trim(), a.href, 'classes:', a.className));

    // After injecting, mark active link by filename
    const current = window.location.pathname.split('/').pop() || 'index.html';
    anchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.endsWith(current) || (current === 'index.html' && href.includes('index.html'))) {
            a.classList.add('active');
        }
    });

    // Add robust click handlers so navigation works reliably from subfolders and file:// pages.
    anchors.forEach(a => {
        const href = a.getAttribute('href') || '';
        // Don't attach to dropdown toggles - those are handled by main.js toggle handler
        if (a.classList.contains('dropdown-toggle')) return;
        // skip fragment links and absolute/external links
        if (!href || href.startsWith('#') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return;
        a.addEventListener('click', (ev) => {
            // compute absolute destination using the browser's URL resolver
            ev.preventDefault();
            try {
                const dest = new URL(href, window.location.href).href;
                window.location.href = dest;
            } catch (err) {
                // fallback: set location to the raw href
                window.location.href = href;
            }
        });
    });

    // Notify other scripts that nav has been injected
    document.dispatchEvent(new CustomEvent('nav-injected'));
});
