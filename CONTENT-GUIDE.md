# Content Guide

This site uses a JSON-driven architecture. Most content changes only require editing `data/site.json`.

## Adding a Project

1. **Create the HTML file** in `projects/`:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <link rel="stylesheet" href="../style.css">
       <title>Project Title - Jesse Angrist</title>
   </head>
   <body>
       <nav class="navbar" id="main-nav"></nav>

       <main>
           <section class="section active">
               <div class="content">
                   <h1>Project Title</h1>
                   <p>Your content here.</p>
               </div>
           </section>
       </main>

       <script src="../main.js"></script>
   </body>
   </html>
   ```

2. **Add to the Projects dropdown** in `data/site.json`:
   ```json
   {
     "title": "My New Project",
     "href": "/projects/my-project.html"
   }
   ```
   Add this to `nav.items[0].items` (the Projects dropdown array).

---

## Adding a New Navbar Section

You can add either a simple link or a dropdown menu.

### Simple Link

Add to the `nav.items` array in `data/site.json`:
```json
{
  "type": "link",
  "label": "About",
  "href": "/about.html"
}
```

Then create `about.html` following the same template as project pages (but with `href="style.css"` instead of `../style.css` since it's at the root).

### Dropdown Menu

Add to the `nav.items` array:
```json
{
  "type": "dropdown",
  "label": "Resources",
  "id": "resources-dropdown",
  "items": [
    { "title": "Documentation", "href": "/resources/docs.html" },
    { "title": "Downloads", "href": "/resources/downloads.html" }
  ]
}
```

The `id` must end in `-dropdown` for the CSS styling to apply correctly.

---

## Cache Note

The navbar data is cached in `sessionStorage` for performance. After editing `site.json`:
- Refresh the page twice, OR
- Open DevTools → Application → Session Storage → Clear

Changes to HTML/CSS/JS files don't require cache clearing.
