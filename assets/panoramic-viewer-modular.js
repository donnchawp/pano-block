/**
 * Modular Panoramic Viewer
 * 
 * Main viewer class that orchestrates the modular components
 */

import { PanoramicUtils } from './modules/panoramic-utils.js';
import { PanoramicRenderer } from './modules/panoramic-renderer.js';
import { PanoramicControls } from './modules/panoramic-controls.js';
import { PanoramicAccessibility } from './modules/panoramic-accessibility.js';

class PanoramicViewer {
	constructor() {
		// Core components
		this.modal = null;
		this.canvas = null;
		this.viewer = null;
		this.renderer = null;
		this.controls = null;
		this.accessibility = null;
		
		// UI elements
		this.closeBtn = null;
		this.zoomInBtn = null;
		this.zoomOutBtn = null;
		this.zoomResetBtn = null;
		
		// State
		this._lastImageUrls = null;
		
		// Bind methods
		this.handleCloseClick = this.close.bind(this);
		this.handleZoomInClick = () => this.zoom(1.2);
		this.handleZoomOutClick = () => this.zoom(0.8);
		this.handleZoomResetClick = () => this.resetView();
		this.handleModalKeydown = this.handleModalKeydown.bind(this);
		this.handleModalClick = (e) => {
			if (e.target === this.modal) {
				this.close();
			}
		};

		this.init();
	}

	/**
	 * Initialize the viewer
	 */
	init() {
		this.createModal();
		this.initializeComponents();
		this.bindEvents();
	}

	/**
	 * Create modal structure
	 */
	createModal() {
		this.modal = document.createElement('div');
		this.modal.className = 'panoramic-modal';
		this.modal.setAttribute('role', 'dialog');
		this.modal.setAttribute('aria-modal', 'true');
		this.modal.setAttribute('aria-labelledby', 'panoramic-viewer-title');

		this.modal.innerHTML = `
			<div class="panoramic-viewer-container">
				<button class="panoramic-close" aria-label="Close panoramic viewer" title="Close (Esc)">&times;</button>
				<h2 id="panoramic-viewer-title" class="sr-only">Panoramic Image Viewer</h2>
				<div class="panoramic-loading" id="panoramic-loading" aria-live="polite" aria-label="Loading panoramic image" style="display: none;">
					<div class="panoramic-loading-spinner" aria-hidden="true"></div>
					<span>Loading panoramic view...</span>
				</div>
				<div class="panoramic-viewer" role="img" tabindex="0" aria-describedby="panoramic-instructions panoramic-controls-help" aria-label="Interactive panoramic image viewer">
					<canvas aria-hidden="true"></canvas>
				</div>
				<div class="panoramic-controls" role="toolbar" aria-label="Panoramic viewer controls">
					<button class="panoramic-zoom-out" aria-label="Zoom out" title="Zoom out (-)" aria-describedby="panoramic-zoom-help">-</button>
					<button class="panoramic-zoom-reset" aria-label="Reset zoom and position" title="Reset zoom (0)" aria-describedby="panoramic-reset-help">Reset</button>
					<button class="panoramic-zoom-in" aria-label="Zoom in" title="Zoom in (+)" aria-describedby="panoramic-zoom-help">+</button>
				</div>
				<div id="panoramic-instructions" class="sr-only">
					Interactive panoramic image viewer. Use arrow keys or drag to pan the image. Use + and - keys or controls to zoom. Press 0 to reset view. Press Escape to close.
				</div>
				<div id="panoramic-controls-help" class="sr-only">
					Zoom controls available. Current zoom level and position will be announced when changed.
				</div>
				<div id="panoramic-zoom-help" class="sr-only">
					Zoom in or out of the panoramic image
				</div>
				<div id="panoramic-reset-help" class="sr-only">
					Reset zoom level to fit view and center the image
				</div>
				<div id="panoramic-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
			</div>
		`;

		document.body.appendChild(this.modal);
		this.cacheElements();
	}

	/**
	 * Cache DOM elements
	 */
	cacheElements() {
		this.canvas = this.modal.querySelector('canvas');
		this.viewer = this.modal.querySelector('.panoramic-viewer');
		this.closeBtn = this.modal.querySelector('.panoramic-close');
		this.zoomInBtn = this.modal.querySelector('.panoramic-zoom-in');
		this.zoomOutBtn = this.modal.querySelector('.panoramic-zoom-out');
		this.zoomResetBtn = this.modal.querySelector('.panoramic-zoom-reset');
	}

	/**
	 * Initialize component modules
	 */
	initializeComponents() {
		this.renderer = new PanoramicRenderer(this.canvas);
		this.controls = new PanoramicControls(this.viewer, this.renderer);
		this.accessibility = new PanoramicAccessibility(this.modal, this.renderer);
	}

	/**
	 * Bind UI event listeners
	 */
	bindEvents() {
		// Button events
		this.closeBtn.addEventListener('click', this.handleCloseClick);
		this.zoomInBtn.addEventListener('click', this.handleZoomInClick);
		this.zoomOutBtn.addEventListener('click', this.handleZoomOutClick);
		this.zoomResetBtn.addEventListener('click', this.handleZoomResetClick);

		// Modal events
		this.modal.addEventListener('click', this.handleModalClick);

		// Thumbnail click events
		this.bindThumbnailEvents();
	}

	/**
	 * Bind thumbnail click events
	 */
	bindThumbnailEvents() {
		const attachEvents = () => {
			const thumbnails = document.querySelectorAll(
				'.panoramic-image-block-thumbnail, .single-panoramic-image-block-thumbnail'
			);
			
			thumbnails.forEach((thumbnail) => {
				thumbnail.addEventListener('click', (e) =>
					this.openViewer(e.currentTarget)
				);
				thumbnail.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this.openViewer(e.currentTarget);
					}
				});
			});
		};

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', attachEvents);
		} else {
			attachEvents();
		}
	}

	/**
	 * Open viewer with image data
	 * @param {HTMLElement} thumbnail - Thumbnail element
	 */
	async openViewer(thumbnail) {
		const blockType = thumbnail.dataset.blockType || 'panoramic';
		const altText = thumbnail.dataset.alt;

		this.accessibility.updateTitle(altText || 'Panoramic Image Viewer');

		// Remove any previous error message
		const oldError = this.modal.querySelector('.panoramic-error');
		if (oldError) oldError.remove();

		let imagesData;
		let imageUrls;

		try {
			if (blockType === 'single') {
				const imageData = JSON.parse(thumbnail.dataset.image);
				if (!PanoramicUtils.validateImageData(imageData, 'single')) {
					throw new Error('Invalid single image data');
				}
				imagesData = [imageData];
				imageUrls = [imageData.url];
			} else {
				imagesData = JSON.parse(thumbnail.dataset.images);
				if (!PanoramicUtils.validateImageData(imagesData, 'multiple')) {
					throw new Error('Invalid multiple images data');
				}
				imageUrls = imagesData.map(img => img.url);
			}

			// Check if images have changed
			const shouldReload = this.shouldReloadImages(imageUrls);

			if (shouldReload) {
				this.accessibility.showLoading();
				
				await this.renderer.loadImages(imagesData);
				
				if (blockType === 'single') {
					await this.renderer.setupSingleImage();
				} else {
					await this.renderer.stitchImages();
				}
				
				this._lastImageUrls = imageUrls;
				this.accessibility.hideLoading();
				this.accessibility.announceLoadingSuccess();
				this.accessibility.provideImageDescription(blockType, imagesData.length);
			}

			this.renderer.resetView();
			this.modal.classList.add('active');

			// Setup accessibility
			this.accessibility.setInitialFocus(this.viewer);
			this.accessibility.trapFocus();

			// Add document keydown handler for escape
			document.addEventListener('keydown', this.handleModalKeydown);

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

		} catch (error) {
			console.error('Error opening panoramic viewer:', error);
			this.accessibility.hideLoading();
			this.accessibility.announceLoadingError();
			this.showError('Failed to load panoramic images. Please try again.');
		}
	}

	/**
	 * Check if images should be reloaded
	 * @param {Array} imageUrls - New image URLs
	 * @returns {boolean} Whether to reload images
	 */
	shouldReloadImages(imageUrls) {
		return !this._lastImageUrls || 
			   this._lastImageUrls.length !== imageUrls.length || 
			   this._lastImageUrls.some((url, i) => url !== imageUrls[i]);
	}

	/**
	 * Show error message
	 * @param {string} message - Error message
	 */
	showError(message) {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'panoramic-error';
		errorDiv.setAttribute('aria-live', 'polite');
		errorDiv.textContent = message;
		errorDiv.style.cssText = 'color: red; text-align: center; margin: 1em 0;';
		this.modal.querySelector('.panoramic-viewer-container').prepend(errorDiv);
	}

	/**
	 * Close the viewer
	 */
	close() {
		this.modal.classList.remove('active');
		document.body.style.overflow = '';

		// Remove document keydown handler
		document.removeEventListener('keydown', this.handleModalKeydown);

		// Cleanup accessibility
		this.accessibility.restoreFocus();
		this.accessibility.removeFocusTrap();
	}

	/**
	 * Zoom by factor with accessibility announcement
	 * @param {number} factor - Zoom factor
	 */
	zoom(factor) {
		const oldScale = this.renderer.scale;
		const zoomed = this.renderer.zoom(factor);
		
		if (zoomed) {
			this.accessibility.announceZoomChange(oldScale, this.renderer.scale);
		}
	}

	/**
	 * Reset view with accessibility announcement
	 */
	resetView() {
		this.renderer.resetView();
		this.accessibility.announceViewReset(this.renderer.scale);
	}

	/**
	 * Handle modal keydown events
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	handleModalKeydown(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.close();
		}
	}

	/**
	 * Destroy the viewer and cleanup resources
	 */
	destroy() {
		this.close();

		// Cleanup components
		if (this.controls) {
			this.controls.destroy();
		}
		if (this.renderer) {
			this.renderer.destroy();
		}
		if (this.accessibility) {
			this.accessibility.destroy();
		}

		// Remove event listeners
		if (this.closeBtn) {
			this.closeBtn.removeEventListener('click', this.handleCloseClick);
		}
		if (this.zoomInBtn) {
			this.zoomInBtn.removeEventListener('click', this.handleZoomInClick);
		}
		if (this.zoomOutBtn) {
			this.zoomOutBtn.removeEventListener('click', this.handleZoomOutClick);
		}
		if (this.zoomResetBtn) {
			this.zoomResetBtn.removeEventListener('click', this.handleZoomResetClick);
		}
		if (this.modal) {
			this.modal.removeEventListener('click', this.handleModalClick);
		}

		// Remove modal from DOM
		if (this.modal && this.modal.parentNode) {
			this.modal.parentNode.removeChild(this.modal);
		}

		// Clear references
		this.modal = null;
		this.canvas = null;
		this.viewer = null;
		this.renderer = null;
		this.controls = null;
		this.accessibility = null;
	}
}

// Add screen reader only styles (same as before)
if (!document.getElementById('pano-sr-only-style')) {
	const srOnlyStyle = document.createElement('style');
	srOnlyStyle.id = 'pano-sr-only-style';
	srOnlyStyle.textContent = `
		.sr-only {
			position: absolute !important;
			width: 1px !important;
			height: 1px !important;
			padding: 0 !important;
			margin: -1px !important;
			overflow: hidden !important;
			clip: rect(0, 0, 0, 0) !important;
			white-space: nowrap !important;
			border: 0 !important;
		}
	`;
	document.head.appendChild(srOnlyStyle);
}

// Export for global access
window.PanoramicViewer = PanoramicViewer;

// Initialize on DOM ready
window.initPanoramicViewer = function() {
	if (!window._panoViewerInstance) {
		window._panoViewerInstance = new PanoramicViewer();
	}
	return window._panoViewerInstance;
};

document.addEventListener('DOMContentLoaded', function() {
	if (!window._panoViewerInstance) {
		window._panoViewerInstance = window.initPanoramicViewer();
	}
});