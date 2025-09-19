 with your Google account
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file

## Usage

1. **Upload Documents**
   - Drag and drop files or click to browse
   - Supports multiple file selection
   - Maximum file size: 10MB per file

2. **Configure Settings**
   - Select target language or use auto-detection
   - Enable/disable layout preservation
   - Toggle table detection
   - Optional image enhancement for low-quality scans

3. **Process Documents**
   - Click "Start OCR Processing"
   - Monitor real-time progress
   - View processing status for each step

4. **View Results**
   - **Extracted Text**: Plain text output
   - **Layout Preserved**: Formatted text maintaining original structure
  - **Document Analysis**: Statistics, confidence scores, and structural analysis

5. **Export Results**
   - Copy to clipboard
   - Download as TXT, JSON, PDF, or DOCX
   - Include metadata and analysis in exports

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Header)
│   ├── upload/          # Upload-related components
│   ├── results/         # Results display components
│   └── modals/          # Modal dialogs
├── hooks/               # Custom React hooks
├── services/            # API and business logic
├── store/              # Zustand state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── styles/             # Global styles

## Available Scripts

```bash
# Development
npm run dev          # Start development server

# Building
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

## Configuration

The app can be configured through the Settings modal:

- **API Key**: Your Gemini API key
- **Model**: Choose between Gemini 1.5 Flash, Pro, or Pro Vision
- **Max Tokens**: Control output length (256-8192)

Settings are persisted in localStorage.

## Cloudflare Deployment & Database

This project now ships with a Cloudflare Pages + D1 backend to persist projects, uploaded file metadata, OCR results, and summaries.

1. **Create the D1 database**
   ```bash
   wrangler d1 create ocrpro-db
   ```
   Copy the generated `database_id` into `wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

2. **Apply migrations**
   ```bash
   wrangler d1 migrations apply ocrpro-db --local  # against local preview
   wrangler d1 migrations apply ocrpro-db          # against production binding
   ```

3. **Run locally with API support**
   ```bash
   npm install
   wrangler pages dev
   ```
   The Vite bundle and Pages Functions run together under Wrangler so that `/api/*` routes resolve to the D1-backed endpoints.

4. **Configure secrets**
   ```bash
   wrangler pages secret put VITE_GEMINI_API_KEY
   # Optional: override API host if calling a separate Worker
   wrangler pages secret put VITE_API_BASE_URL
   ```

5. **Deploy**
   ```bash
   npm run build
   wrangler pages deploy dist
   ```

### Data model overview

- `projects` – basic project metadata (name, description, timestamps)
- `files` – uploaded file descriptors, including preview data URLs for quick reloads
- `results` – OCR output, metadata, and analysis payloads keyed by file
- `project_summaries` – summarized content, ToC, and proofreading notes

Client-side state is hydrated from these tables on load. Creating projects, assigning files, updating results, and saving summaries now syncs to D1 automatically.

## Performance Optimizations

- Lazy loading of settings modals and result tabs with `React.lazy` keeps the initial bundle focused on the core upload flow.
- Debounced autosave and proofreading requests in the layout editor prevent unnecessary API calls while editing results.
- The Zustand store persists OCR state locally and applies optimistic updates before syncing to the Cloudflare D1 backend, so uploads and edits stay responsive during network calls.
- TIFF uploads are normalized and scaled before previewing, reducing memory pressure when working with large scans.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Google Gemini AI for OCR processing
- React community for excellent libraries
- Contributors and testers

## Support

For issues and questions, please open an issue on GitHub.

## Automatic Deployment ✨

This project now includes automatic deployment to Cloudflare Pages via GitHub Actions!
