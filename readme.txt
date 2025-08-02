=== Panoramic Image Block ===
Contributors: donncha
Tags: panoramic, images, block, gallery, panorama
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Display panoramic images with interactive viewers. Display panoramas from single or 3 stitched images with drag, zoom, and keyboard navigation.

== Description ==

**Panoramic Image Block** is a powerful WordPress Gutenberg plugin that provides two specialized blocks for displaying panoramic images with interactive viewers. Perfect for showcasing landscapes, architecture, events, or any wide-angle view.

### Two Block Types

#### 1. Panoramic Image Block (3 Images)
Creates panoramic images by automatically stitching together 3 uploaded images.

#### 2. Single Panoramic Image Block (1 Image)
Displays a single large panoramic image with full interactive viewer capabilities.

### Key Features

* **Dual Block Support** - Choose between 3-image stitching or single image display
* **Easy Image Selection** - Upload images directly from your WordPress media library
* **Automatic Stitching** - 3 images are seamlessly combined into a single panoramic view
* **Interactive Viewer** - Click thumbnails to open full-screen panoramic viewers
* **Touch & Mouse Support** - Drag to pan on both desktop and mobile devices
* **Zoom Functionality** - Zoom in/out with mouse wheel, buttons, or keyboard shortcuts
* **Keyboard Navigation** - Full keyboard support for accessibility (arrow keys, +/-, 0 to reset)
* **Responsive Design** - Works perfectly on all screen sizes and devices
* **Accessibility Ready** - ARIA labels, screen reader support, and keyboard navigation
* **No External Dependencies** - Works entirely within WordPress, no third-party services

### How It Works

#### Panoramic Image Block (3 Images)
1. Add the "Panoramic Image Block" to your post or page
2. Select 3 images from your media library
3. Add alt text for accessibility
4. Publish your content
5. Visitors can click the thumbnail to explore the panoramic view

#### Single Panoramic Image Block (1 Image)
1. Add the "Single Panoramic Image Block" to your post or page
2. Select 1 large panoramic image from your media library
3. Add alt text for accessibility
4. Publish your content
5. Visitors can click the thumbnail to explore the panoramic view

### Perfect For

* **Real Estate** - Showcase property interiors and exteriors
* **Travel & Tourism** - Display scenic landscapes and cityscapes
* **Architecture** - Present building designs and spaces
* **Events** - Capture wide venue shots and group photos
* **Art & Photography** - Create immersive visual experiences

The plugin requires no configuration - simply install, activate, and start creating panoramic content!

== Installation ==

### Automatic Installation

1. Go to your WordPress admin dashboard
2. Navigate to Plugins → Add New
3. Search for "Panoramic Image Block"
4. Click "Install Now" and then "Activate"

### Manual Installation

1. Download the plugin ZIP file
2. Go to Plugins → Add New → Upload Plugin
3. Choose the ZIP file and click "Install Now"
4. Activate the plugin

### Using the Blocks

#### Panoramic Image Block (3 Images)
1. Edit a post or page in the block editor
2. Click the "+" button to add a new block
3. Search for "Panoramic Image Block" or find it in the Media category
4. Click to add the block
5. Select 3 images from your media library
6. Add alt text in the block settings panel
7. Publish your content

#### Single Panoramic Image Block (1 Image)
1. Edit a post or page in the block editor
2. Click the "+" button to add a new block
3. Search for "Single Panoramic Image Block" or find it in the Media category
4. Click to add the block
5. Select 1 large panoramic image from your media library
6. Add alt text in the block settings panel
7. Publish your content

== Frequently Asked Questions ==

= What image formats are supported? =

The plugin supports all image formats that WordPress supports by default: JPEG, PNG, GIF, and WebP.

= How many images do I need for each block type? =

* **Panoramic Image Block**: Exactly 3 images are required to create a panoramic view. The plugin will automatically stitch them together horizontally.
* **Single Panoramic Image Block**: Exactly 1 large panoramic image is required.

= What's the recommended image size? =

* **Panoramic Image Block**: For best results, use images that have been split into 3 even parts. Images between 800-2000 pixels wide work well.
* **Single Panoramic Image Block**: Use large panoramic images, typically 2000-8000 pixels wide for best viewing experience.

= Can I use images of different sizes? =

* **Panoramic Image Block**: Yes! The plugin automatically handles images of different dimensions by aligning them vertically and scaling appropriately.
* **Single Panoramic Image Block**: The image will be displayed at its original aspect ratio and can be any size.

= How do I split a panorama into 3 parts for the Panoramic Image Block? =

Use ImageMagick like this:
```
magick input.jpg -crop 33.33%x100% "output_split_%d.jpg"
```

= Does it work on mobile devices? =

Absolutely! Both blocks provide panoramic viewers that are fully responsive and support touch gestures for panning and zooming on mobile devices.

= Is it accessible? =

Yes, both blocks follow WordPress accessibility guidelines with proper ARIA labels, keyboard navigation, and screen reader support.

= Can I customize the appearance? =

The plugin uses semantic CSS classes that can be styled with custom CSS. The viewers respect your theme's content width constraints.

= Does it affect page loading speed? =

The plugin only loads its JavaScript and CSS when the blocks are actually used on a page, minimizing performance impact.

= Can I use it with page builders? =

The plugin is designed for the WordPress block editor (Gutenberg). Compatibility with other page builders may vary.

= Is translation support available? =

Yes, the plugin is translation-ready with proper text domain implementation for all user-facing strings.

= Which block should I use? =

* Use the **Panoramic Image Block** when you have 3 separate images that need to be stitched together
* Use the **Single Panoramic Image Block** when you already have a complete panoramic image file

== Changelog ==

= 1.0.0 =
* Initial release
* Gutenberg block for panoramic image creation from 3 images
* Single panoramic image block for displaying large panoramic images
* Automatic 3-image stitching functionality  
* Interactive panoramic viewers with drag/zoom support
* Full keyboard and touch navigation
* Responsive design for all devices
* Accessibility features with ARIA labels
* WordPress coding standards compliance
* Translation ready with text domain support

== Upgrade Notice ==

= 1.0.0 =
Initial release of Panoramic Image Block with dual block support. Start displaying stunning panoramic images today!

== Development ==

This plugin is actively developed on GitHub. Contributions, bug reports, and feature requests are welcome!

**GitHub Repository:** https://github.com/donnchawp/panoramic-image-block

### Browser Support

* Chrome 60+
* Firefox 55+  
* Safari 12+
* Edge 79+
* Mobile browsers with Canvas support

### WordPress Compatibility

* WordPress 6.0+
* PHP 7.4+
* Gutenberg block editor

== Privacy ==

This plugin does not collect any user data. All image processing happens locally in the user's browser using HTML5 Canvas. No images are sent to external services.
