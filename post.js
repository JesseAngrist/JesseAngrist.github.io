// Single post viewer logic
document.addEventListener('DOMContentLoaded', async () => {
    const contentEl = document.getElementById('post-content');
    if (!contentEl) return;

    const basePath = typeof getBasePath === 'function' ? getBasePath() : '.';
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
        contentEl.innerHTML = '<p>Post not found.</p>';
        return;
    }

    try {
        // Fetch the markdown file
        const mdResponse = await fetch(`${basePath}/blog/posts/${slug}.md`);
        if (!mdResponse.ok) throw new Error('Post not found');
        const markdown = await mdResponse.text();

        // Fetch site data to get post metadata
        const dataResponse = await fetch(`${basePath}/data/site.json`);
        const data = await dataResponse.json();
        const postMeta = data.blog.posts.find(p => p.slug === slug);

        // Parse markdown
        const html = marked.parse(markdown);

        // Build post header
        let postHtml = '';
        if (postMeta) {
            const dateStr = new Date(postMeta.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
            postHtml += `<p class="post-date">${dateStr}</p>`;
            document.getElementById('page-title').textContent =
                `${postMeta.title} - Jesse Angrist`;
        }
        postHtml += html;

        contentEl.innerHTML = postHtml;

    } catch (error) {
        console.error('Failed to load post:', error);
        contentEl.innerHTML = '<p>Sorry, this post could not be loaded.</p>';
    }
});
