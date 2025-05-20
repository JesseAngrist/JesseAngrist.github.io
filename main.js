document.addEventListener('DOMContentLoaded', () => {
    // Get all navigation links and sections
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');

    // Add click event listeners to all navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked link and corresponding section
            link.classList.add('active');
            const targetSection = document.querySelector(link.getAttribute('href'));
            targetSection.classList.add('active');
        });
    });
});
