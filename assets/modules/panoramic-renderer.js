/**
 * Panoramic Renderer
 * 
 * Handles all canvas rendering operations for panoramic images
 */

import { PanoramicUtils } from './panoramic-utils.js';

export class PanoramicRenderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.stitchedCanvas = null;
		this.images = [];
		
		// Rendering state
		this.scale = 1;
		this.minScale = 0.5;
		this.maxScale = 3;
		this.panX = 0;
		this.panY = 0;
		
		// Performance settings
		this.renderFPS = 60;
		this.renderInterval = 1000 / this.renderFPS;
		this._renderScheduled = false;
		this._lastRenderTime = 0;
	}

	/**
	 * Load and prepare images for rendering
	 * @param {Array} imagesData - Array of image data objects
	 * @returns {Promise<void>}
	 */
	async loadImages(imagesData) {
		const loadPromises = imagesData.map(imgData => 
			PanoramicUtils.loadImageWithTimeout(imgData.url, 10000)
		);
		
		this.images = await Promise.all(loadPromises);
	}

	/**
	 * Setup single image for rendering (no stitching)
	 * @returns {Promise<void>}
	 */
	async setupSingleImage() {
		if (this.images.length !== 1) return;

		const img = this.images[0];
		this.stitchedCanvas = document.createElement('canvas');
		this.stitchedCanvas.width = img.width;
		this.stitchedCanvas.height = img.height;

		const ctx = this.stitchedCanvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, this.stitchedCanvas.width, this.stitchedCanvas.height);
		ctx.drawImage(img, 0, 0, img.width, img.height);
	}

	/**
	 * Stitch multiple images together
	 * @returns {Promise<void>}
	 */
	async stitchImages() {
		if (this.images.length !== 3) return;

		const maxHeight = Math.max(...this.images.map(img => img.height));
		const totalWidth = this.images.reduce((sum, img) => sum + img.width, 0);

		this.stitchedCanvas = document.createElement('canvas');
		this.stitchedCanvas.width = totalWidth;
		this.stitchedCanvas.height = maxHeight;

		const stitchedCtx = this.stitchedCanvas.getContext('2d');
		stitchedCtx.fillStyle = 'white';
		stitchedCtx.fillRect(0, 0, this.stitchedCanvas.width, this.stitchedCanvas.height);

		let x = 0;
		this.images.forEach((img, index) => {
			const y = (maxHeight - img.height) / 2;
			const overlap = index > 0 ? 2 : 0;
			stitchedCtx.drawImage(
				img,
				x - overlap,
				y,
				img.width + overlap,
				img.height
			);
			x += img.width;
		});
	}

	/**
	 * Reset view to optimal scale and center position
	 */
	resetView() {
		if (!this.stitchedCanvas) return;

		const viewerRect = this.canvas.getBoundingClientRect();

		// Resize canvas if needed
		if (this.canvas.width !== viewerRect.width || this.canvas.height !== viewerRect.height) {
			this.canvas.width = viewerRect.width;
			this.canvas.height = viewerRect.height;
		}

		// Calculate optimal scale
		this.scale = PanoramicUtils.calculateOptimalScale(
			this.stitchedCanvas.width,
			this.stitchedCanvas.height,
			this.canvas.width,
			this.canvas.height
		);

		// Center the image
		this.panX = 0;
		this.panY = 0;

		this.renderImmediate();
	}

	/**
	 * Render the panoramic image to canvas
	 */
	render() {
		if (!this.stitchedCanvas || !this.ctx || !this.canvas) {
			return;
		}

		try {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

			const scaledWidth = this.stitchedCanvas.width * this.scale;
			const scaledHeight = this.stitchedCanvas.height * this.scale;

			const x = (this.canvas.width - scaledWidth) / 2 + this.panX;
			const y = (this.canvas.height - scaledHeight) / 2 + this.panY;

			this.ctx.drawImage(
				this.stitchedCanvas,
				0, 0,
				this.stitchedCanvas.width,
				this.stitchedCanvas.height,
				x, y,
				scaledWidth,
				scaledHeight
			);
		} catch (error) {
			console.error('Error rendering panoramic image:', error);
			throw error; // Re-throw for error handling in parent
		}
	}

	/**
	 * Schedule render with FPS throttling
	 */
	scheduleRender() {
		if (!this._renderScheduled) {
			this._renderScheduled = true;
			requestAnimationFrame((currentTime) => {
				this._renderScheduled = false;
				
				const timeSinceLastRender = currentTime - this._lastRenderTime;
				if (timeSinceLastRender >= this.renderInterval) {
					this._lastRenderTime = currentTime;
					this.render();
				} else {
					this.scheduleRender();
				}
			});
		}
	}

	/**
	 * Render immediately (for critical updates)
	 */
	renderImmediate() {
		if (this._renderScheduled) {
			this._renderScheduled = false;
		}
		this.render();
		this._lastRenderTime = performance.now();
	}

	/**
	 * Apply zoom factor
	 * @param {number} factor - Zoom factor (1.2 = zoom in, 0.8 = zoom out)
	 * @returns {boolean} Whether zoom was applied
	 */
	zoom(factor) {
		const newScale = PanoramicUtils.clamp(
			this.scale * factor,
			this.minScale,
			this.maxScale
		);

		if (newScale !== this.scale) {
			this.scale = newScale;
			this.constrainPan();
			this.scheduleRender();
			return true;
		}
		return false;
	}

	/**
	 * Set pan position
	 * @param {number} x - X offset
	 * @param {number} y - Y offset
	 */
	setPan(x, y) {
		this.panX = x;
		this.panY = y;
		this.constrainPan();
		this.scheduleRender();
	}

	/**
	 * Constrain pan within image bounds
	 */
	constrainPan() {
		if (!this.stitchedCanvas) return;

		const scaledWidth = this.stitchedCanvas.width * this.scale;
		const scaledHeight = this.stitchedCanvas.height * this.scale;

		const maxPanX = Math.max(0, (scaledWidth - this.canvas.width) / 2);
		const maxPanY = Math.max(0, (scaledHeight - this.canvas.height) / 2);

		this.panX = PanoramicUtils.clamp(this.panX, -maxPanX, maxPanX);
		this.panY = PanoramicUtils.clamp(this.panY, -maxPanY, maxPanY);
	}

	/**
	 * Get current scale as percentage
	 * @returns {number} Scale percentage
	 */
	getScalePercent() {
		return Math.round(this.scale * 100);
	}

	/**
	 * Check if renderer is ready
	 * @returns {boolean} Whether renderer has stitched canvas
	 */
	isReady() {
		return !!this.stitchedCanvas;
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		if (this._renderScheduled) {
			this._renderScheduled = false;
		}
		
		this.ctx = null;
		this.stitchedCanvas = null;
		this.images = [];
	}
}