// Determine base path for assets (handles root vs subdirectory pages)
function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/projects/') || path.includes('/blog/')) {
        return '..';
    }
    return '.';
}

// Build navbar HTML from JSON data
function buildNavbar(navData, basePath) {
    let html = `<div class="nav-brand"><a href="${basePath}/">${navData.brand.text}</a></div>`;
    html += '<ul class="nav-links">';

    for (const item of navData.items) {
        if (item.type === 'link') {
            html += `<li><a href="${basePath}${item.href}">${item.label}</a></li>`;
        } else if (item.type === 'dropdown') {
            html += buildDropdown(item, basePath);
        }
    }

    html += '</ul>';
    return html;
}

// Build dropdown menu HTML
function buildDropdown(dropdown, basePath) {
    let html = `<li class="${dropdown.id}">`;
    html += `<a href="#" class="dropdown-toggle">${dropdown.label} &#9662;</a>`;
    html += '<ul class="dropdown-menu">';

    for (const item of dropdown.items) {
        html += `<li><a href="${basePath}${item.href}">${item.title}</a></li>`;
    }

    html += '</ul></li>';
    return html;
}

// Initialize dropdown toggle behavior
function initDropdowns() {
    const dropdownContainers = document.querySelectorAll('[class$="-dropdown"]');

    dropdownContainers.forEach(container => {
        const toggle = container.querySelector('.dropdown-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            // Close other dropdowns
            dropdownContainers.forEach(c => {
                if (c !== container) c.classList.remove('open');
            });
            container.classList.toggle('open');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        let clickedInside = false;
        dropdownContainers.forEach(c => {
            if (c.contains(e.target)) clickedInside = true;
        });
        if (!clickedInside) {
            dropdownContainers.forEach(c => c.classList.remove('open'));
        }
    });
}

// Highlight active link based on current page
function setActiveLink() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('#')) return;

        // Normalize paths for comparison
        const linkPath = href.replace(/^\.\.?/, '').replace(/^\//, '');
        const pagePath = currentPath.replace(/^\//, '');

        if (pagePath.endsWith(linkPath) || pagePath === linkPath) {
            link.classList.add('active');
        }
    });
}

// Fetch site data with caching
async function getSiteData(basePath) {
    const cacheKey = 'siteData';
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
        // Use cached data immediately, refresh in background
        fetch(`${basePath}/data/site.json`)
            .then(r => r.json())
            .then(data => sessionStorage.setItem(cacheKey, JSON.stringify(data)))
            .catch(() => {});
        return JSON.parse(cached);
    }

    // First load - fetch and cache
    const response = await fetch(`${basePath}/data/site.json`);
    const data = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    const navElement = document.getElementById('main-nav');
    if (!navElement) return;

    const basePath = getBasePath();

    try {
        const data = await getSiteData(basePath);

        // Build and insert navbar
        navElement.innerHTML = buildNavbar(data.nav, basePath);

        // Initialize dropdown behavior
        initDropdowns();

        // Highlight current page in nav
        setActiveLink();
    } catch (error) {
        console.error('Failed to load navigation:', error);
        navElement.innerHTML = '<div class="nav-brand">Jesse Angrist</div>';
    }
});
