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
   - **Document Analysis**: Statistics, confidence scores, and structure analysis

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

## Performance Optimizations

- Lazy loading of components
- Image compression before processing
- Debounced API calls
- Caching with React Query
- Optimistic UI updates
- Virtual scrolling for large results

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
