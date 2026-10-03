# demo — music snippet sharing site

A dark, responsive music-snippet library built with Next.js. Includes a local audio/cover uploader, genre filtering, snippet details, waveform-style player, shareable link helper, and vertical video export UI targeting **1080 × 1920 (9:16)**.

## Run locally

1. Install Node.js 20.9+.
2. In this folder, run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:3000

## Add your audio

Click **Add snippet**, choose a title, and load an audio file (MP3/WAV/M4A) and optional cover image. The uploaded files are local browser object URLs and last only for the current session; this starter does not upload files to a server or database. For permanent public snippets, place audio and cover files in `public/audio` and `public/covers`, then wire their paths into the track data in `app/page.tsx` and redeploy.

## Export a vertical MP4 snippet video

1. Select a snippet and load its audio file with **Add snippet** / **Replace audio / cover**.
2. Click **Generate MP4** in the Share as video panel.
3. The browser renders a 1080 × 1920 canvas at 30 fps, records a temporary WebM stream, then converts it locally with **ffmpeg.wasm** to an `.mp4` using H.264 video + AAC audio. The downloaded filename ends in `-1080x1920.mp4`.
4. The first export downloads the FFmpeg WebAssembly engine from jsDelivr (~31 MB); subsequent exports reuse the loaded engine for that page session. Chrome or Edge desktop is recommended.

The conversion follows the official ffmpeg.wasm browser workflow for transcoding WebM to MP4.

The artwork is generated in the canvas as a clean abstract graphic, so the export still works without uploaded cover art. The preview uses an interface mock-up; the exported file is rendered independently at full vertical resolution.

## Deploy with GitHub + Vercel

1. Create a GitHub repository named `demo` and push this project.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the Next.js defaults.
3. Deploy. Each push to the connected branch triggers a new deployment.

## Current MVP limitations

- Demo tracks are sample metadata, not bundled music.
- Uploads are browser-local and not persisted or visible to other visitors.
- Share links encode the selected snippet in the URL but public deep-link loading/database persistence is not wired yet.
- MP4 conversion is performed in the browser with ffmpeg.wasm, so export time depends on the computer and snippet length.
- Use only audio and artwork you own or have permission to share.
