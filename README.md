# Jesse Angrist - Personal Website

A static personal website showcasing my work. (Proudly vibe coded!)

## Structure

```
├── index.html          # Homepage with bio and avatar
├── main.js             # Navbar builder and dropdown logic
├── style.css           # Solarized dark theme styles
├── data/
│   └── site.json       # Navigation config (projects dropdown, external links)
├── projects/
│   ├── MAE573.html     # Long-distance transmission study
│   ├── MAE422.html     # German electricity system study
│   ├── SPI306.html     # Rural microgrids study
│   └── pdfs/           # Embedded PDF reports
└── images/
    └── avatar.jpg
```

## How It Works

- **Data-driven navbar**: `main.js` fetches `data/site.json` and builds the navbar dynamically, supporting dropdowns and external links
- **Session caching**: Navbar data is cached in sessionStorage for performance
- **Static HTML projects**: Each project is a standalone HTML page with embedded PDF reports

## Adding Content

See [CONTENT-GUIDE.md](CONTENT-GUIDE.md) for instructions on adding projects and navbar items.

## External Links

The blog links to [jesseangrist.substack.com](https://jesseangrist.substack.com) (opens in new tab).

## Deployment

Hosted via GitHub Pages with custom domain configured in `CNAME`.
