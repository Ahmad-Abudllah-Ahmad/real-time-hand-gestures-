# Image to Audio to Image Converter

This is a web application that converts images into audio files (WAV) and can reconstruct the original image from the generated audio.

## Features

- **Encode Mode**: Convert an image (PNG, JPG, JPEG) into a WAV audio file.
- **Decode Mode**: Upload the generated WAV file to reconstruct the original image.
- **Visualizations**: See the image preview and the reconstruction process in real-time.

## How to Run Locally

Simply open the `index.html` file in your web browser. No server is required for basic functionality, although some browsers might restrict file access if not running on a local server.

For the best experience, use a simple local server:

1.  If you have Python installed:
    ```bash
    python3 -m http.server
    ```
    Then open `http://localhost:8000`.

2.  If you have Node.js installed:
    ```bash
    npx serve .
    ```

## Deployment

This project is a static web application, meaning it can be deployed to any static site hosting provider.

### GitHub Pages
1.  Push this repository to GitHub.
2.  Go to Settings > Pages.
3.  Select the `main` branch and `/` (root) folder.
4.  Save.

### Netlify
1.  Drag and drop this folder into the Netlify dashboard.
2.  Or connect your GitHub repository and let Netlify build it automatically.

### Vercel
1.  Install Vercel CLI: `npm i -g vercel`
2.  Run `vercel` in this directory.
3.  Follow the prompts.

## Technologies Used

- **HTML5**: Structure and layout.
- **Tailwind CSS**: Styling (via CDN).
- **JavaScript**: Core logic for image processing and audio generation.
