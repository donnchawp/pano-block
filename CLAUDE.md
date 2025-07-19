# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WordPress Gutenberg block plugin that creates panoramic images from 3 stitched images with an interactive viewer. The plugin uses WordPress block API v3 and follows WordPress coding standards.

## Development Commands

```bash
# Development build with file watching
npm run start

# Production build 
npm run build

# Code formatting
npm run format

# JavaScript linting
npm run lint:js

# CSS linting  
npm run lint:css

# Update @wordpress packages
npm run packages-update

# Create plugin zip file (files at root level)
npm run plugin-zip

# Create plugin zip file with proper directory structure (recommended for distribution)
npm run plugin-zip-folder
```

## Architecture

### Core Components
- **Main Plugin File**: `pano-block.php` - PHP class that registers the block and handles server-side rendering
- **Block Configuration**: `block.json` - Defines block attributes, supports, and file references
- **Frontend Viewer**: `assets/panoramic-viewer.js` - Interactive panoramic viewer functionality
- **Block Editor Components**: `src/edit.js`, `src/save.js`, `src/index.js` - Gutenberg editor integration

### Block Structure
- **Block Name**: `pano-block/panoramic`
- **Required Images**: Exactly 3 images for panoramic stitching
- **Attributes**: `images` (array of 3 image objects), `altText` (string)
- **Frontend Rendering**: PHP render callback generates thumbnail with data attributes for JS viewer
- **Editor Rendering**: React components with Canvas API for image stitching preview

### Key Features
- Canvas-based image stitching in block editor
- Interactive viewer with pan/zoom controls
- Touch and keyboard navigation support
- Responsive design with WordPress alignment support
- Accessibility features (ARIA labels, keyboard navigation)

## WordPress Integration
- Uses `@wordpress/scripts` for build tooling
- Follows WordPress Block API v3 standards
- Server-side rendering with `render_callback`
- Proper enqueueing of scripts/styles only when block is present
- Internationalization ready with text domain `pano-block`

## Browser Requirements
- Canvas API support required for image stitching
- Modern browsers (Chrome 60+, Firefox 55+, Safari 12+, Edge 79+)