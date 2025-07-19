# Panoramic Image Block

A WordPress Gutenberg block that creates panoramic images from 3 stitched images with an interactive viewer.

## Features

- **Easy Image Selection**: Upload 3 images through WordPress media library
- **Automatic Stitching**: Images are stitched together horizontally to create panoramic view
- **Interactive Viewer**: Click thumbnail to open full-screen panoramic viewer
- **Touch & Mouse Support**: Drag to pan on desktop and mobile devices
- **Zoom Functionality**: Zoom in/out with mouse wheel, buttons, or keyboard
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Responsive Design**: Works on all screen sizes
- **Accessibility**: ARIA labels, screen reader support, and keyboard navigation

## Installation

1. Download or clone this repository to your WordPress plugins directory:
   ```bash
   cd wp-content/plugins/
   git clone [repository-url] pano-block
   ```

2. Install dependencies:
   ```bash
   cd pano-block
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Activate the plugin in WordPress admin: Plugins → Installed Plugins → Pano Block → Activate

## Usage

1. **Add the Block**: In the WordPress block editor, click '+' and search for "Panoramic Image"

2. **Select Images**: Click "Select Images" and choose 3 images from your media library

3. **Preview**: The editor will show individual images and a stitched preview

4. **Configure**: Add alt text in the block settings panel for accessibility

5. **Publish**: The block will display a thumbnail on your page/post

6. **View**: Visitors can click the thumbnail to open the interactive panoramic viewer

## Viewer Controls

### Mouse/Desktop:
- **Drag**: Click and drag to pan the image
- **Scroll**: Mouse wheel to zoom in/out
- **Buttons**: Use zoom controls at bottom of viewer

### Keyboard:
- **Arrow Keys**: Pan the image left/right/up/down
- **+ / =**: Zoom in
- **-**: Zoom out  
- **0**: Reset zoom and position
- **Esc**: Close viewer
- **Tab**: Navigate between controls

### Touch/Mobile:
- **Drag**: Touch and drag to pan the image
- **Pinch**: Pinch to zoom (if supported)
- **Tap**: Use zoom control buttons

## Development

### Build Commands

```bash
# Development build with watch
npm run start

# Production build
npm run build

# Linting
npm run lint:js
npm run lint:css

# Format code
npm run format
```

### File Structure

```
pano-block/
├── pano-block.php          # Main plugin file
├── block.json              # Block configuration
├── package.json            # Dependencies and scripts
├── webpack.config.js       # Build configuration
├── src/                    # Source files
│   ├── index.js           # Block registration
│   ├── edit.js            # Editor component
│   ├── save.js            # Save component
│   └── style.scss         # Styles
├── assets/                 # Frontend assets
│   └── panoramic-viewer.js # Viewer functionality
└── build/                  # Compiled files (generated)
    ├── index.js
    ├── index.css
    └── style-index.css
```

## Technical Details

- **WordPress Version**: 6.0+
- **PHP Version**: 7.4+
- **Block API**: Version 3
- **Image Stitching**: HTML5 Canvas
- **Responsive**: CSS Grid and Flexbox
- **Accessibility**: WCAG 2.1 AA compliant

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers with Canvas support

## License

GPL v2 or later

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issues page.