// Initialize UI behaviors after nav is present. Some pages inject nav.html at runtime.
function initUI() {
    console.debug('initUI called');
    // Get all navigation links and sections
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');
    console.debug('navLinks found:', navLinks.length, 'sections found:', sections.length);
    // Support multiple dropdown containers (projects, personal, etc.)
    const dropdownContainers = document.querySelectorAll('.projects-dropdown, .personal-dropdown');
    console.debug('dropdownContainers found:', dropdownContainers.length);

    // Handle section navigation (internal links)
    navLinks.forEach(link => {
        // If link goes to an internal anchor, handle via JS
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                // Remove active class from all links and sections
                navLinks.forEach(l => l.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                // Add active class to clicked link and corresponding section
                link.classList.add('active');
                const targetSection = document.querySelector(href);
                if (targetSection) targetSection.classList.add('active');
            }
        });
    });

    // Toggle dropdowns on click and close when clicking outside
    dropdownContainers.forEach(container => {
        const toggle = container.querySelector('.dropdown-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', (e) => {
            console.debug('dropdown toggle clicked for', container.className);
            e.preventDefault();
            // close other dropdowns
            dropdownContainers.forEach(c => { if (c !== container) c.classList.remove('open');
                const otherMenu = c.querySelector('.dropdown-menu');
                if (otherMenu) otherMenu.style.display = '';
            });
            container.classList.toggle('open');

            // Force show/hide to work around any CSS specificity/clipping issues
            const menu = container.querySelector('.dropdown-menu');
            if (menu) {
                if (container.classList.contains('open')) {
                    menu.style.display = 'block';
                    menu.style.left = '0';
                    menu.style.right = 'auto';
                    const rect = menu.getBoundingClientRect();
                    console.debug('dropdown menu shown, rect=', rect);
                } else {
                    menu.style.display = 'none';
                }
            }
        });
    });

    // Close any open dropdown when clicking outside
    document.addEventListener('click', (e) => {
        let clickedInsideAny = false;
        dropdownContainers.forEach(c => { if (c.contains(e.target)) clickedInsideAny = true; });
        if (!clickedInsideAny) {
            dropdownContainers.forEach(c => c.classList.remove('open'));
        }
    });

    // Highlight active link on project/personal pages. Support nested paths like 'projects/project1.html'
    const currentPath = window.location.pathname.split('/').slice(-2).join('/'); // e.g., 'projects/project1.html' or 'project1.html'
    if (currentPath) {
        navLinks.forEach(l => {
            const href = l.getAttribute('href');
            // If the href matches exactly the current path or matches only the filename portion
            if (href === currentPath || href === currentPath.split('/').pop()) {
                navLinks.forEach(x => x.classList.remove('active'));
                l.classList.add('active');
            }
        });
    }
}

// If nav already exists, init immediately; otherwise wait for inject-nav to signal
if (document.querySelector('.nav-links')) {
    document.addEventListener('DOMContentLoaded', initUI);
} else {
    // Wait for nav to be injected
    document.addEventListener('nav-injected', () => {
        initUI();
    });
    // As a fallback, init once DOMContentLoaded fires too
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { if (document.querySelector('.nav-links')) initUI(); }, 120);
    });
}
