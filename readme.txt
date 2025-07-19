=== Panoramic Image Block ===
Contributors: donncha
Tags: panoramic, images, block, gallery, panorama
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Create stunning panoramic images from 3 photos with an interactive viewer for drag, zoom, and keyboard navigation.

== Description ==

**Panoramic Image Block** is a powerful WordPress Gutenberg block that allows you to create beautiful panoramic images by automatically stitching together 3 uploaded images. Perfect for showcasing landscapes, architecture, events, or any wide-angle view.

### Key Features

* **Easy Image Selection** - Upload 3 images directly from your WordPress media library
* **Automatic Stitching** - Images are seamlessly combined into a single panoramic view
* **Interactive Viewer** - Click the thumbnail to open a full-screen panoramic viewer
* **Touch & Mouse Support** - Drag to pan on both desktop and mobile devices
* **Zoom Functionality** - Zoom in/out with mouse wheel, buttons, or keyboard shortcuts
* **Keyboard Navigation** - Full keyboard support for accessibility (arrow keys, +/-, 0 to reset)
* **Responsive Design** - Works perfectly on all screen sizes and devices
* **Accessibility Ready** - ARIA labels, screen reader support, and keyboard navigation
* **No External Dependencies** - Works entirely within WordPress, no third-party services

### How It Works

1. Add the "Panoramic Image" block to your post or page
2. Select 3 images from your media library
3. Add alt text for accessibility
4. Publish your content
5. Visitors can click the thumbnail to explore the panoramic view

### Perfect For

* **Real Estate** - Showcase property interiors and exteriors
* **Travel & Tourism** - Display scenic landscapes and cityscapes
* **Architecture** - Present building designs and spaces
* **Events** - Capture wide venue shots and group photos
* **Art & Photography** - Create immersive visual experiences

### Technical Details

* Uses HTML5 Canvas for image processing
* Mobile-friendly touch gestures
* Keyboard shortcuts: Arrow keys (pan), +/- (zoom), 0 (reset), Esc (close)
* Follows WordPress coding standards
* Translation ready with text domain support
* Clean, semantic HTML output

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

### Using the Block

1. Edit a post or page in the block editor
2. Click the "+" button to add a new block
3. Search for "Panoramic Image Block" or find it in the Media category
4. Click to add the block
5. Select 3 images from your media library
6. Add alt text in the block settings panel
7. Publish your content

== Frequently Asked Questions ==

= What image formats are supported? =

The plugin supports all image formats that WordPress supports by default: JPEG, PNG, GIF, and WebP.

= How many images do I need? =

Exactly 3 images are required to create a panoramic view. The plugin will automatically stitch them together horizontally.

= What's the recommended image size? =

For best results, use images with similar heights and overlapping content at the edges. Images between 800-2000 pixels wide work well.

= Can I use images of different sizes? =

Yes! The plugin automatically handles images of different dimensions by aligning them vertically and scaling appropriately.

= Does it work on mobile devices? =

Absolutely! The panoramic viewer is fully responsive and supports touch gestures for panning and zooming on mobile devices.

= Is it accessible? =

Yes, the plugin follows WordPress accessibility guidelines with proper ARIA labels, keyboard navigation, and screen reader support.

= Can I customize the appearance? =

The plugin uses semantic CSS classes that can be styled with custom CSS. The viewer respects your theme's content width constraints.

= Does it affect page loading speed? =

The plugin only loads its JavaScript and CSS when the block is actually used on a page, minimizing performance impact.

= Can I use it with page builders? =

The plugin is designed for the WordPress block editor (Gutenberg). Compatibility with other page builders may vary.

= Is translation support available? =

Yes, the plugin is translation-ready with proper text domain implementation for all user-facing strings.

== Screenshots ==

1. **Block Editor Interface** - Easy 3-image selection with live stitching preview
2. **Frontend Thumbnail** - Responsive thumbnail with play overlay that fits your content width  
3. **Panoramic Viewer** - Full-screen interactive viewer with pan and zoom controls
4. **Mobile Experience** - Touch-friendly navigation on mobile devices
5. **Block Settings** - Simple settings panel for alt text and accessibility

== Changelog ==

= 1.0.0 =
* Initial release
* Gutenberg block for panoramic image creation
* Automatic 3-image stitching functionality  
* Interactive panoramic viewer with drag/zoom support
* Full keyboard and touch navigation
* Responsive design for all devices
* Accessibility features with ARIA labels
* WordPress coding standards compliance
* Translation ready with text domain support

== Upgrade Notice ==

= 1.0.0 =
Initial release of Panoramic Image Block. Start creating stunning panoramic images today!

== Development ==

This plugin is actively developed on GitHub. Contributions, bug reports, and feature requests are welcome!

**GitHub Repository:** https://github.com/donnchawp/pano-block

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