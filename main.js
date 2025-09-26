document.addEventListener('DOMContentLoaded', () => {
    // Get all navigation links and sections
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');
    // Support multiple dropdown containers (projects, personal, etc.)
    const dropdownContainers = document.querySelectorAll('.projects-dropdown, .personal-dropdown');

    // Handle section navigation (internal links)
    navLinks.forEach(link => {
        // If link goes to an external project page (ends with .html), let it navigate normally
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
            e.preventDefault();
            // close other dropdowns
            dropdownContainers.forEach(c => { if (c !== container) c.classList.remove('open'); });
            container.classList.toggle('open');
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
    
    // Highlight active link on project pages
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
});
