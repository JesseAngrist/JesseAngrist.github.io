// DEPRECATED: Blog functionality has moved to jesseangrist.substack.com
// This file is no longer in use and can be removed in a future cleanup.

// Blog listing page logic
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('blog-posts');
    if (!container) return;

    const basePath = typeof getBasePath === 'function' ? getBasePath() : '.';

    try {
        const response = await fetch(`${basePath}/data/site.json`);
        const data = await response.json();

        if (!data.blog || !data.blog.posts || data.blog.posts.length === 0) {
            container.innerHTML = '<p>No posts yet. Check back soon!</p>';
            return;
        }

        // Sort posts by date (newest first)
        const posts = data.blog.posts.sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // Group by month/year
        const grouped = groupByMonth(posts);

        // Render
        container.innerHTML = renderGroupedPosts(grouped, basePath);
    } catch (error) {
        console.error('Failed to load blog posts:', error);
        container.innerHTML = '<p>Failed to load posts.</p>';
    }
});

function groupByMonth(posts) {
    const groups = {};
    for (const post of posts) {
        const date = new Date(post.date);
        const key = date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        });
        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    }
    return groups;
}

function renderGroupedPosts(grouped, basePath) {
    let html = '';
    for (const [monthYear, posts] of Object.entries(grouped)) {
        html += `<h2 class="blog-month">${monthYear}</h2>`;
        html += '<ul class="blog-list">';
        for (const post of posts) {
            const dateStr = new Date(post.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
            });
            html += `
                <li class="blog-item">
                    <a href="${basePath}/post.html?slug=${post.slug}">
                        <span class="blog-date">${dateStr}</span>
                        <span class="blog-title">${post.title}</span>
                    </a>
                </li>
            `;
        }
        html += '</ul>';
    }
    return html;
}
