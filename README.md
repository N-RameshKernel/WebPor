# Ramesh N. — Portfolio

A responsive, static portfolio adapted from the supplied BLOTTER site template. The design keeps its bold display typography and editorial feel while replacing the type-foundry content with profile, experience, and selected project information.

Published site: https://n-rameshkernel.github.io/WebPor/

## View locally

From this folder, start a local static server:

    python -m http.server 8000

Then open http://localhost:8000.

## Edit the site

- index.html contains the page content and project links.
- assets/site.css contains the layout, colors, and responsive styling.
- assets/site.js handles the mobile navigation and current-year footer.
- assets/liquid-ink.js renders the WebGL liquid-ink pointer effect.

There is no build step or package installation. The site uses Google Fonts when a network connection is available and falls back to local system fonts otherwise. The liquid-ink pointer effect uses WebGL and is disabled when reduced motion is requested.

## Content sources

The profile, education, experience, contact links, and research summary were adapted from the supplied Profile.pdf. The selected GitHub projects link to public repositories on the N-RameshKernel profile. Repository descriptions are summarized for display.
