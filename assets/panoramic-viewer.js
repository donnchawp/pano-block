/**
 * Panoramic Utilities
 * Shared utilities for image validation, canvas operations, and common functions
 */
class PanoramicUtils {
	static validateImageData(data, type = 'multiple') {
		if (type === 'single') {
			return data && typeof data === 'object' && data.url;
		}
		return Array.isArray(data) && data.length === 3 && data.every(img => img && typeof img === 'object' && img.url);
	}

	static loadImageWithTimeout(url, timeout = 10000) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			let isResolved = false;

			const timer = setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					reject(new Error(`TIMEOUT:Image load timeout: ${url}`));
				}
			}, timeout);

			img.onload = () => {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timer);
					resolve(img);
				}
			};

			img.onerror = () => {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timer);
					reject(new Error(`NETWORK:Image failed to load: ${url}`));
				}
			};

			img.src = url;
		});
	}

	static async loadImageWithRetry(url, maxRetries = 3, baseDelay = 1000) {
		let lastError;
		
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Progressive timeout increase with each retry
				const timeout = 5000 + (attempt * 2000);
				return await this.loadImageWithTimeout(url, timeout);
			} catch (error) {
				lastError = error;
				
				// Don't retry on the last attempt
				if (attempt === maxRetries) {
					break;
				}
				
				// Exponential backoff with jitter
				const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
				console.warn(`Image load attempt ${attempt + 1} failed for ${url}, retrying in ${Math.round(delay)}ms...`);
				
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
		
		throw lastError;
	}

	static createThumbnailUrl(originalUrl, size = 300) {
		if (!originalUrl) return originalUrl;
		
		// Extract extension
		const extension = originalUrl.split('.').pop();
		
		// For WordPress attachment URLs, try to generate thumbnail URL
		const wpSizePattern = /(-\d+x\d+)(\.\w+)$/;
		const wpScaledPattern = /(-scaled)(\.\w+)$/;
		
		if (wpSizePattern.test(originalUrl)) {
			// Already has size suffix, replace it
			return originalUrl.replace(wpSizePattern, `-${size}x${size}$2`);
		} else if (wpScaledPattern.test(originalUrl)) {
			// Has -scaled suffix, replace with size
			return originalUrl.replace(wpScaledPattern, `-${size}x${size}$2`);
		} else {
			// Add size suffix before extension
			return originalUrl.replace(new RegExp(`\\.${extension}$`), `-${size}x${size}.${extension}`);
		}
	}

	static async loadImageProgressive(url, onThumbnailLoad = null, onRetryAttempt = null) {
		let thumbnailImg = null;
		
		// Try to load thumbnail first if we have a callback for it
		if (onThumbnailLoad) {
			try {
				const thumbnailUrl = this.createThumbnailUrl(url, 150);
				
				// Only try thumbnail loading if the URL is different and looks valid
				if (thumbnailUrl !== url && !url.includes('-scaled')) {
					thumbnailImg = await this.loadImageWithTimeout(thumbnailUrl, 2000);
					onThumbnailLoad(thumbnailImg);
				}
				// For scaled images or if thumbnail URL is same as original, skip thumbnail loading
			} catch (thumbnailError) {
				// Silently continue to full image loading - this is expected for some images
			}
		}

		// Load full resolution image with retry mechanism
		let fullImg;
		try {
			fullImg = await this.loadImageWithRetry(url);
		} catch (retryError) {
			// If retry callback is provided, call it with error details
			if (onRetryAttempt) {
				onRetryAttempt({
					url,
					error: retryError,
					errorType: this.getErrorType(retryError)
				});
			}
			throw retryError;
		}
		
		return { thumbnail: thumbnailImg, full: fullImg };
	}

	static getErrorType(error) {
		const message = error.message || '';
		if (message.startsWith('TIMEOUT:')) {
			return 'timeout';
		} else if (message.startsWith('NETWORK:')) {
			return 'network';
		} else if (message.includes('404') || message.includes('Not Found')) {
			return 'not_found';
		} else if (message.includes('403') || message.includes('Forbidden')) {
			return 'forbidden';
		} else if (message.includes('CORS')) {
			return 'cors';
		}
		return 'unknown';
	}

	static calculateOptimalScale(imageWidth, imageHeight, containerWidth, containerHeight) {
		const heightScale = containerHeight / imageHeight;
		const widthScale = containerWidth / imageWidth;
		
		// For panoramic images, we want to fill one dimension and allow scrolling in the other
		// If the image is much wider than it is tall (panoramic), scale to fill height
		const aspectRatio = imageWidth / imageHeight;
		if (aspectRatio > 2) {
			// Wide panoramic image - scale to fill height, allow horizontal scrolling
			return heightScale;
		} else {
			// Square or tall image - scale to fit both dimensions
			return Math.min(heightScale, widthScale);
		}
	}

	static clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	static calculateDistance(x1, y1, x2, y2) {
		const deltaX = x2 - x1;
		const deltaY = y2 - y1;
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	}
}

/**
 * Panoramic Renderer
 * Handles all canvas rendering operations for panoramic images
 */
class PanoramicRenderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.stitchedCanvas = null;
		this.images = [];
		
		this.scale = 1;
		this.minScale = 0.5;
		this.maxScale = 3;
		this.panX = 0;
		this.panY = 0;
		
		this.renderFPS = 60;
		this.renderInterval = 1000 / this.renderFPS;
		this._renderScheduled = false;
		this._lastRenderTime = 0;
	}

	async loadImages(imagesData, progressCallback = null, errorCallback = null) {
		this.images = [];
		this.thumbnailImages = [];
		this.loadingErrors = [];
		
		const loadPromises = imagesData.map(async (imgData, index) => {
			const onThumbnailLoad = (thumbnailImg) => {
				this.thumbnailImages[index] = thumbnailImg;
				if (progressCallback) {
					progressCallback({
						type: 'thumbnail',
						index,
						total: imagesData.length,
						image: thumbnailImg
					});
				}
			};

			const onRetryAttempt = (errorInfo) => {
				this.loadingErrors.push({
					index,
					url: imgData.url,
					...errorInfo
				});
				if (errorCallback) {
					errorCallback({
						type: 'retry',
						index,
						total: imagesData.length,
						...errorInfo
					});
				}
			};

			try {
				const result = await PanoramicUtils.loadImageProgressive(
					imgData.url, 
					onThumbnailLoad, 
					onRetryAttempt
				);
				
				if (progressCallback) {
					progressCallback({
						type: 'full',
						index,
						total: imagesData.length,
						image: result.full
					});
				}
				
				return result.full;
			} catch (error) {
				// Record final error
				const errorInfo = {
					index,
					url: imgData.url,
					error,
					errorType: PanoramicUtils.getErrorType(error)
				};
				this.loadingErrors.push(errorInfo);
				
				if (errorCallback) {
					errorCallback({
						type: 'failed',
						index,
						total: imagesData.length,
						...errorInfo
					});
				}
				
				throw error;
			}
		});
		
		this.images = await Promise.all(loadPromises);
	}

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

	async stitchImages() {
		if (this.images.length !== 3) return;
		this.createStitchedCanvas(this.images);
	}

	async stitchThumbnails() {
		if (!this.thumbnailImages || this.thumbnailImages.length !== 3) return;
		// Filter out any null/undefined thumbnails
		const validThumbnails = this.thumbnailImages.filter(img => img);
		if (validThumbnails.length === 0) return;
		
		this.createStitchedCanvas(validThumbnails, true);
	}

	createStitchedCanvas(images, isThumbnail = false) {
		const maxHeight = Math.max(...images.map(img => img.height));
		const totalWidth = images.reduce((sum, img) => sum + img.width, 0);
		
		if (isThumbnail) {
			// Create temporary thumbnail canvas
			this.thumbnailStitchedCanvas = document.createElement('canvas');
			this.thumbnailStitchedCanvas.width = totalWidth;
			this.thumbnailStitchedCanvas.height = maxHeight;
			var canvas = this.thumbnailStitchedCanvas;
		} else {
			// Create main stitched canvas
			this.stitchedCanvas = document.createElement('canvas');
			this.stitchedCanvas.width = totalWidth;
			this.stitchedCanvas.height = maxHeight;
			var canvas = this.stitchedCanvas;
		}
		
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		let x = 0;
		images.forEach((img, index) => {
			const y = (maxHeight - img.height) / 2;
			const overlap = index > 0 ? 2 : 0;
			ctx.drawImage(img, x - overlap, y, img.width + overlap, img.height);
			x += img.width;
		});
	}

	resetView() {
		const canvasToUse = this.stitchedCanvas || this.thumbnailStitchedCanvas;
		if (!canvasToUse) return;
		
		const viewerRect = this.canvas.getBoundingClientRect();
		if (this.canvas.width !== viewerRect.width || this.canvas.height !== viewerRect.height) {
			this.canvas.width = viewerRect.width;
			this.canvas.height = viewerRect.height;
		}
		
		this.scale = PanoramicUtils.calculateOptimalScale(
			canvasToUse.width, canvasToUse.height,
			this.canvas.width, this.canvas.height
		);
		
		this.panX = 0;
		this.panY = 0;
		this.renderImmediate();
	}

	render() {
		if (!this.ctx || !this.canvas) return;
		
		// Use thumbnail canvas if main canvas isn't ready
		const canvasToRender = this.stitchedCanvas || this.thumbnailStitchedCanvas;
		if (!canvasToRender) return;
		
		try {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			const scaledWidth = canvasToRender.width * this.scale;
			const scaledHeight = canvasToRender.height * this.scale;
			const x = (this.canvas.width - scaledWidth) / 2 + this.panX;
			const y = (this.canvas.height - scaledHeight) / 2 + this.panY;
			
			// Add slight blur to thumbnail to indicate it's loading
			if (canvasToRender === this.thumbnailStitchedCanvas && this.stitchedCanvas) {
				this.ctx.filter = 'blur(1px) brightness(0.9)';
			} else {
				this.ctx.filter = 'none';
			}
			
			this.ctx.drawImage(canvasToRender, 0, 0, canvasToRender.width, canvasToRender.height, x, y, scaledWidth, scaledHeight);
			this.ctx.filter = 'none'; // Reset filter
		} catch (error) {
			console.error('Error rendering panoramic image:', error);
			throw error;
		}
	}

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

	renderImmediate() {
		if (this._renderScheduled) {
			this._renderScheduled = false;
		}
		this.render();
		this._lastRenderTime = performance.now();
	}

	zoom(factor) {
		const newScale = PanoramicUtils.clamp(this.scale * factor, this.minScale, this.maxScale);
		if (newScale !== this.scale) {
			this.scale = newScale;
			this.constrainPan();
			this.scheduleRender();
			return true;
		}
		return false;
	}

	setPan(x, y) {
		this.panX = x;
		this.panY = y;
		this.constrainPan();
		this.scheduleRender();
	}

	constrainPan() {
		const canvasToUse = this.stitchedCanvas || this.thumbnailStitchedCanvas;
		if (!canvasToUse) return;
		
		const scaledWidth = canvasToUse.width * this.scale;
		const scaledHeight = canvasToUse.height * this.scale;
		const maxPanX = Math.max(0, (scaledWidth - this.canvas.width) / 2);
		const maxPanY = Math.max(0, (scaledHeight - this.canvas.height) / 2);
		this.panX = PanoramicUtils.clamp(this.panX, -maxPanX, maxPanX);
		this.panY = PanoramicUtils.clamp(this.panY, -maxPanY, maxPanY);
	}

	getScalePercent() {
		return Math.round(this.scale * 100);
	}

	destroy() {
		if (this._renderScheduled) {
			this._renderScheduled = false;
		}
		this.ctx = null;
		this.stitchedCanvas = null;
		this.thumbnailStitchedCanvas = null;
		this.images = [];
		this.thumbnailImages = [];
		this.loadingErrors = [];
	}
}

/**
 * Panoramic Controls
 * Handles all user interactions including mouse, touch, and keyboard controls
 */
class PanoramicControls {
	constructor(viewer, renderer) {
		this.viewer = viewer;
		this.renderer = renderer;
		this.isDragging = false;
		this.isMouseDown = false;
		this.startX = 0;
		this.startY = 0;
		this.initialMouseX = 0;
		this.initialMouseY = 0;
		this.dragThreshold = 5;
		this.lastTouchDistance = 0;
		
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleMouseLeave = this.handleMouseLeave.bind(this);
		this.handleWheel = this.handleWheel.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchMove = this.handleTouchMove.bind(this);
		this.handleTouchEnd = this.handleTouchEnd.bind(this);
		this.handleKeyDown = this.handleKeyDown.bind(this);
		
		this.attachEventListeners();
	}

	attachEventListeners() {
		this.viewer.addEventListener('mousedown', this.handleMouseDown);
		this.viewer.addEventListener('mousemove', this.handleMouseMove);
		this.viewer.addEventListener('mouseup', this.handleMouseUp);
		this.viewer.addEventListener('mouseleave', this.handleMouseLeave);
		this.viewer.addEventListener('wheel', this.handleWheel, { passive: false });
		this.viewer.addEventListener('touchstart', this.handleTouchStart, { passive: false });
		this.viewer.addEventListener('touchmove', this.handleTouchMove, { passive: false });
		this.viewer.addEventListener('touchend', this.handleTouchEnd);
		this.viewer.addEventListener('keydown', this.handleKeyDown);
	}

	handleMouseDown(e) {
		this.isMouseDown = true;
		this.initialMouseX = e.clientX;
		this.initialMouseY = e.clientY;
		this.viewer.classList.add('grabbing');
	}

	handleMouseMove(e) {
		if (!this.isMouseDown) return;
		const deltaX = e.clientX - this.initialMouseX;
		const deltaY = e.clientY - this.initialMouseY;
		const distance = PanoramicUtils.calculateDistance(0, 0, deltaX, deltaY);
		if (!this.isDragging && distance > this.dragThreshold) {
			this.startPan(this.initialMouseX, this.initialMouseY);
		}
		if (this.isDragging) {
			e.preventDefault();
			this.dragPan(e.clientX, e.clientY);
		}
	}

	handleMouseUp() {
		this.isMouseDown = false;
		this.endPan();
		this.viewer.classList.remove('grabbing');
	}

	handleMouseLeave() {
		this.isMouseDown = false;
		this.endPan();
		this.viewer.classList.remove('grabbing');
	}

	handleWheel(e) {
		e.preventDefault();
		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		const rect = this.viewer.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		this.zoomAtPoint(zoomFactor, mouseX, mouseY);
	}

	handleTouchStart(e) {
		e.preventDefault();
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			this.startPan(touch.clientX, touch.clientY);
		} else if (e.touches.length === 2) {
			this.startPinchZoom(e.touches);
		}
	}

	handleTouchMove(e) {
		e.preventDefault();
		if (e.touches.length === 1 && this.isDragging) {
			const touch = e.touches[0];
			this.dragPan(touch.clientX, touch.clientY);
		} else if (e.touches.length === 2) {
			this.handlePinchZoom(e.touches);
		}
	}

	handleTouchEnd() {
		this.endPan();
		this.lastTouchDistance = 0;
	}

	handleKeyDown(e) {
		const step = 20;
		const isRTL = document.documentElement.dir === 'rtl' || 
					  document.body.dir === 'rtl' ||
					  getComputedStyle(document.documentElement).direction === 'rtl';
		
		let handled = false;
		switch (e.key) {
			case 'ArrowLeft':
				// In RTL, left arrow should move right in the image
				const leftStep = isRTL ? -step : step;
				this.renderer.setPan(this.renderer.panX + leftStep, this.renderer.panY);
				handled = true;
				break;
			case 'ArrowRight':
				// In RTL, right arrow should move left in the image
				const rightStep = isRTL ? step : -step;
				this.renderer.setPan(this.renderer.panX + rightStep, this.renderer.panY);
				handled = true;
				break;
			case 'ArrowUp':
				this.renderer.setPan(this.renderer.panX, this.renderer.panY + step);
				handled = true;
				break;
			case 'ArrowDown':
				this.renderer.setPan(this.renderer.panX, this.renderer.panY - step);
				handled = true;
				break;
			case '+':
			case '=':
				this.zoom(1.2);
				handled = true;
				break;
			case '-':
				this.zoom(0.8);
				handled = true;
				break;
			case '0':
				this.resetView();
				handled = true;
				break;
		}
		if (handled) {
			e.preventDefault();
		}
	}

	startPan(x, y) {
		this.isDragging = true;
		this.startX = x - this.renderer.panX;
		this.startY = y - this.renderer.panY;
		this.viewer.classList.add('dragging');
	}

	dragPan(x, y) {
		if (!this.isDragging) return;
		const newPanX = x - this.startX;
		const newPanY = y - this.startY;
		this.renderer.setPan(newPanX, newPanY);
	}

	endPan() {
		this.isDragging = false;
		this.viewer.classList.remove('dragging');
	}

	startPinchZoom(touches) {
		const distance = this.getTouchDistance(touches);
		this.lastTouchDistance = distance;
	}

	handlePinchZoom(touches) {
		if (this.lastTouchDistance === 0) {
			this.startPinchZoom(touches);
			return;
		}
		const currentDistance = this.getTouchDistance(touches);
		const scaleChange = currentDistance / this.lastTouchDistance;
		const centerX = (touches[0].clientX + touches[1].clientX) / 2;
		const centerY = (touches[0].clientY + touches[1].clientY) / 2;
		const rect = this.viewer.getBoundingClientRect();
		const zoomCenterX = centerX - rect.left;
		const zoomCenterY = centerY - rect.top;
		this.zoomAtPoint(scaleChange, zoomCenterX, zoomCenterY);
		this.lastTouchDistance = currentDistance;
	}

	getTouchDistance(touches) {
		if (touches.length < 2) return 0;
		return PanoramicUtils.calculateDistance(
			touches[0].clientX, touches[0].clientY,
			touches[1].clientX, touches[1].clientY
		);
	}

	zoomAtPoint(factor, pointX, pointY) {
		const oldScale = this.renderer.scale;
		const zoomed = this.renderer.zoom(factor);
		if (zoomed) {
			const scaleChange = this.renderer.scale / oldScale;
			const canvasCenterX = this.renderer.canvas.width / 2;
			const canvasCenterY = this.renderer.canvas.height / 2;
			const offsetX = pointX - canvasCenterX;
			const offsetY = pointY - canvasCenterY;
			this.renderer.panX -= offsetX * (scaleChange - 1);
			this.renderer.panY -= offsetY * (scaleChange - 1);
			this.renderer.constrainPan();
			this.renderer.scheduleRender();
		}
		return zoomed;
	}

	zoom(factor) {
		return this.renderer.zoom(factor);
	}

	resetView() {
		this.renderer.resetView();
	}

	removeEventListeners() {
		this.viewer.removeEventListener('mousedown', this.handleMouseDown);
		this.viewer.removeEventListener('mousemove', this.handleMouseMove);
		this.viewer.removeEventListener('mouseup', this.handleMouseUp);
		this.viewer.removeEventListener('mouseleave', this.handleMouseLeave);
		this.viewer.removeEventListener('wheel', this.handleWheel);
		this.viewer.removeEventListener('touchstart', this.handleTouchStart);
		this.viewer.removeEventListener('touchmove', this.handleTouchMove);
		this.viewer.removeEventListener('touchend', this.handleTouchEnd);
		this.viewer.removeEventListener('keydown', this.handleKeyDown);
	}

	destroy() {
		this.removeEventListeners();
		this.viewer = null;
		this.renderer = null;
	}
}

/**
 * Panoramic Accessibility
 * Handles accessibility features including screen reader support, ARIA labels, and focus management
 */
class PanoramicAccessibility {
	constructor(modal, renderer) {
		this.modal = modal;
		this.renderer = renderer;
		this.statusEl = null;
		this.loadingEl = null;
		this.titleEl = null;
		this.previousFocus = null;
		this.trapFocusHandler = null;
		this.initializeElements();
	}

	initializeElements() {
		this.statusEl = this.modal.querySelector('#panoramic-status');
		this.loadingEl = this.modal.querySelector('#panoramic-loading');
		this.titleEl = this.modal.querySelector('#panoramic-viewer-title');
	}

	showLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'block';
			this.announceStatus('Loading panoramic image...');
		}
	}

	hideLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'none';
		}
	}

	announceStatus(message, clearDelay = 3000) {
		if (this.statusEl) {
			this.statusEl.textContent = message;
			if (clearDelay > 0) {
				setTimeout(() => {
					if (this.statusEl) {
						this.statusEl.textContent = '';
					}
				}, clearDelay);
			}
		}
	}

	announceZoomChange(oldScale, newScale) {
		const strings = window.panoramicImageBlockData?.strings || {};
		const zoomPercent = Math.round(newScale * 100);
		
		if (newScale > oldScale) {
			const message = strings.zoomedIn ? 
				strings.zoomedIn.replace('%d', zoomPercent) :
				`Zoomed in to ${zoomPercent}%`;
			this.announceStatus(message);
		} else {
			const message = strings.zoomedOut ? 
				strings.zoomedOut.replace('%d', zoomPercent) :
				`Zoomed out to ${zoomPercent}%`;
			this.announceStatus(message);
		}
	}

	announceViewReset(scale) {
		const strings = window.panoramicImageBlockData?.strings || {};
		const zoomPercent = Math.round(scale * 100);
		const message = strings.viewReset ? 
			strings.viewReset.replace('%d', zoomPercent) :
			`View reset. Zoom: ${zoomPercent}%, centered`;
		this.announceStatus(message);
	}

	announceLoadingSuccess() {
		const strings = window.panoramicImageBlockData?.strings || {};
		this.announceStatus(strings.imageLoaded || 'Panoramic image loaded successfully');
	}

	announceLoadingError() {
		this.announceStatus('Failed to load panoramic images. Please try again.');
	}

	announceContextualError(errorType, retryAvailable = false) {
		let message = '';
		switch (errorType) {
			case 'timeout':
				message = retryAvailable ? 
					'Images are taking too long to load. Retrying with a faster connection might help.' :
					'Images took too long to load. Please check your internet connection and try again.';
				break;
			case 'network':
				message = retryAvailable ?
					'Network error occurred while loading images. Attempting to retry...' :
					'Unable to load images due to network issues. Please check your connection and try again.';
				break;
			case 'not_found':
				message = 'Some images could not be found. They may have been moved or deleted.';
				break;
			case 'forbidden':
				message = 'Access to some images is restricted. Please contact the site administrator.';
				break;
			case 'cors':
				message = 'Images cannot be loaded due to security restrictions.';
				break;
			default:
				message = retryAvailable ?
					'An error occurred while loading images. Attempting to retry...' :
					'Failed to load panoramic images. Please refresh the page and try again.';
		}
		this.announceStatus(message, 5000);
	}

	announceProgressiveLoading(type, current, total) {
		const strings = window.panoramicImageBlockData?.strings || {};
		
		if (type === 'thumbnail') {
			const message = strings.loadingPreview ? 
				`${strings.loadingPreview} ${current} of ${total} thumbnails loaded` :
				`Loading preview... ${current} of ${total} thumbnails loaded`;
			this.announceStatus(message);
		} else if (type === 'full') {
			const message = strings.loadingHighRes ? 
				`${strings.loadingHighRes} ${current} of ${total} images loaded` :
				`Loading high resolution... ${current} of ${total} images loaded`;
			this.announceStatus(message);
		}
	}

	updateTitle(title) {
		if (this.titleEl) {
			this.titleEl.textContent = title || 'Panoramic Image Viewer';
		}
	}

	trapFocus() {
		if (this.trapFocusHandler) {
			this.modal.removeEventListener('keydown', this.trapFocusHandler);
		}
		const focusableElements = this.modal.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		if (focusableElements.length === 0) return;
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		this.trapFocusHandler = (e) => {
			if (e.key === 'Tab') {
				if (e.shiftKey) {
					if (document.activeElement === firstElement) {
						e.preventDefault();
						lastElement.focus();
					}
				} else {
					if (document.activeElement === lastElement) {
						e.preventDefault();
						firstElement.focus();
					}
				}
			}
		};
		this.modal.addEventListener('keydown', this.trapFocusHandler);
	}

	setInitialFocus(viewer) {
		this.previousFocus = document.activeElement;
		if (viewer) {
			viewer.focus();
		}
	}

	restoreFocus() {
		if (this.previousFocus) {
			this.previousFocus.focus();
			this.previousFocus = null;
		}
	}

	removeFocusTrap() {
		if (this.trapFocusHandler) {
			this.modal.removeEventListener('keydown', this.trapFocusHandler);
			this.trapFocusHandler = null;
		}
	}

	provideImageDescription(imageType, imageCount) {
		let description = '';
		if (imageType === 'single') {
			description = 'Single panoramic image viewer. Use controls to zoom and pan around the image.';
		} else {
			description = `Panoramic image created from ${imageCount} stitched images. Use controls to explore the full panoramic view.`;
		}
		this.announceStatus(description, 4000);
	}

	destroy() {
		this.removeFocusTrap();
		this.restoreFocus();
		if (this.statusEl) {
			this.statusEl.textContent = '';
		}
		this.modal = null;
		this.renderer = null;
		this.statusEl = null;
		this.loadingEl = null;
		this.titleEl = null;
	}
}

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

		// Bind handler methods
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

	init() {
		this.createModal();
		this.initializeComponents();
		this.bindEvents();
	}

	/**
	 * Initialize component modules
	 */
	initializeComponents() {
		this.renderer = new PanoramicRenderer(this.canvas);
		this.controls = new PanoramicControls(this.viewer, this.renderer);
		this.accessibility = new PanoramicAccessibility(this.modal, this.renderer);
	}

	createModal() {
		this.modal = document.createElement( 'div' );
		this.modal.className = 'panoramic-modal';
		this.modal.setAttribute( 'role', 'dialog' );
		this.modal.setAttribute( 'aria-modal', 'true' );
		this.modal.setAttribute( 'aria-labelledby', 'panoramic-viewer-title' );

		// Get translatable strings from WordPress localization
		const strings = window.panoramicImageBlockData?.strings || {};
		
		this.modal.innerHTML = `
			<div class="panoramic-viewer-container">
				<button class="panoramic-close" aria-label="${strings.closeViewer || 'Close panoramic viewer'}" title="${strings.closeEsc || 'Close (Esc)'}">&times;</button>
				<h2 id="panoramic-viewer-title" class="sr-only">${strings.viewerTitle || 'Panoramic Image Viewer'}</h2>
				<div class="panoramic-loading" id="panoramic-loading" aria-live="polite" aria-label="${strings.loadingImage || 'Loading panoramic image'}" style="display: none;">
					<div class="panoramic-loading-spinner" aria-hidden="true"></div>
					<span>${strings.loadingView || 'Loading panoramic view...'}</span>
				</div>
				<div class="panoramic-viewer" role="img" tabindex="0" aria-describedby="panoramic-instructions panoramic-controls-help" aria-label="${strings.interactiveViewer || 'Interactive panoramic image viewer'}">
					<canvas aria-hidden="true"></canvas>
				</div>
				<div class="panoramic-controls" role="toolbar" aria-label="${strings.viewerControls || 'Panoramic viewer controls'}">
					<button class="panoramic-zoom-out" aria-label="${strings.zoomOut || 'Zoom out'}" title="${strings.zoomOutKey || 'Zoom out (-)'}" aria-describedby="panoramic-zoom-help">-</button>
					<button class="panoramic-zoom-reset" aria-label="${strings.resetZoom || 'Reset zoom and position'}" title="${strings.resetKey || 'Reset zoom (0)'}" aria-describedby="panoramic-reset-help">${strings.reset || 'Reset'}</button>
					<button class="panoramic-zoom-in" aria-label="${strings.zoomIn || 'Zoom in'}" title="${strings.zoomInKey || 'Zoom in (+)'}" aria-describedby="panoramic-zoom-help">+</button>
				</div>
				<div id="panoramic-instructions" class="sr-only">
					${strings.instructions || 'Interactive panoramic image viewer. Use arrow keys or drag to pan the image. Use + and - keys or controls to zoom. Press 0 to reset view. Press Escape to close.'}
				</div>
				<div id="panoramic-controls-help" class="sr-only">
					${strings.controlsHelp || 'Zoom controls available. Current zoom level and position will be announced when changed.'}
				</div>
				<div id="panoramic-zoom-help" class="sr-only">
					${strings.zoomHelp || 'Zoom in or out of the panoramic image'}
				</div>
				<div id="panoramic-reset-help" class="sr-only">
					${strings.resetHelp || 'Reset zoom level to fit view and center the image'}
				</div>
				<div id="panoramic-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
			</div>
		`;

		document.body.appendChild( this.modal );

		// Cache frequently used elements
		this.canvas = this.modal.querySelector( 'canvas' );
		this.viewer = this.modal.querySelector( '.panoramic-viewer' );
		this.closeBtn = this.modal.querySelector( '.panoramic-close' );
		this.zoomInBtn = this.modal.querySelector( '.panoramic-zoom-in' );
		this.zoomOutBtn = this.modal.querySelector( '.panoramic-zoom-out' );
		this.zoomResetBtn = this.modal.querySelector( '.panoramic-zoom-reset' );

		// Bind modal events (controls are handled by PanoramicControls class)
		this.closeBtn.addEventListener('click', this.handleCloseClick);
		this.zoomInBtn.addEventListener('click', this.handleZoomInClick);
		this.zoomOutBtn.addEventListener('click', this.handleZoomOutClick);
		this.zoomResetBtn.addEventListener('click', this.handleZoomResetClick);

		// Click outside to close
		this.modal.addEventListener('click', this.handleModalClick);
	}

	bindEvents() {
		const attach = () => {
			// Handle both panoramic (3 images) and single panoramic (1 image) blocks
			const thumbnails = document.querySelectorAll('.panoramic-image-block-thumbnail, .single-panoramic-image-block-thumbnail');
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
			document.addEventListener('DOMContentLoaded', attach);
		} else {
			attach();
		}
	}

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
				
				let thumbnailsLoaded = 0;
				let fullImagesLoaded = 0;
				let errorOccurred = false;
				let lastErrorType = 'unknown';
				
				const progressCallback = async (progress) => {
					if (progress.type === 'thumbnail') {
						thumbnailsLoaded++;
						this.accessibility.announceProgressiveLoading('thumbnail', thumbnailsLoaded, progress.total);
						
						// For multi-image panoramic, try to stitch thumbnails as they load
						if (blockType !== 'single' && thumbnailsLoaded === progress.total) {
							try {
								await this.renderer.stitchThumbnails();
								this.renderer.resetView(); // Show thumbnail version immediately
							} catch (error) {
								console.warn('Failed to stitch thumbnails:', error);
							}
						}
					} else if (progress.type === 'full') {
						fullImagesLoaded++;
						this.accessibility.announceProgressiveLoading('full', fullImagesLoaded, progress.total);
					}
				};

				const errorCallback = (errorInfo) => {
					errorOccurred = true;
					lastErrorType = errorInfo.errorType;
					
					if (errorInfo.type === 'retry') {
						this.accessibility.announceContextualError(errorInfo.errorType, true);
					} else if (errorInfo.type === 'failed') {
						this.accessibility.announceContextualError(errorInfo.errorType, false);
					}
				};
				
				await this.renderer.loadImages(imagesData, progressCallback, errorCallback);
				
				if (blockType === 'single') {
					await this.renderer.setupSingleImage();
				} else {
					await this.renderer.stitchImages();
				}
				
				// Re-render with full resolution images
				this.renderer.resetView();
				
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
			
			// Determine error type from the error message or renderer errors
			let errorType = 'unknown';
			let contextualMessage = 'Failed to load panoramic images. Please try again.';
			
			if (this.renderer && this.renderer.loadingErrors && this.renderer.loadingErrors.length > 0) {
				// Use the last recorded error type
				const lastError = this.renderer.loadingErrors[this.renderer.loadingErrors.length - 1];
				errorType = lastError.errorType;
			} else {
				// Fallback to analyzing the thrown error
				errorType = PanoramicUtils.getErrorType(error);
			}
			
			// Generate contextual message based on error type
			switch (errorType) {
				case 'timeout':
					contextualMessage = 'Images are taking too long to load. This may be due to a slow internet connection or large image files.';
					break;
				case 'network':
					contextualMessage = 'Network error occurred while loading images. Please check your internet connection.';
					break;
				case 'not_found':
					contextualMessage = 'Some images could not be found. They may have been moved or deleted.';
					break;
				case 'forbidden':
					contextualMessage = 'Access to images is restricted. Please contact the site administrator.';
					break;
				case 'cors':
					contextualMessage = 'Images cannot be loaded due to browser security restrictions.';
					break;
				default:
					contextualMessage = 'An unexpected error occurred while loading the panoramic images.';
			}
			
			this.accessibility.announceContextualError(errorType, false);
			this.showError(contextualMessage, errorType, { thumbnail });
		}
	}

	/**
	 * Check if images should be reloaded
	 */
	shouldReloadImages(imageUrls) {
		return !this._lastImageUrls || 
			   this._lastImageUrls.length !== imageUrls.length || 
			   this._lastImageUrls.some((url, i) => url !== imageUrls[i]);
	}

	/**
	 * Show enhanced error message with retry option
	 */
	showError(message, errorType = 'unknown', retryData = null) {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'panoramic-error';
		errorDiv.setAttribute('aria-live', 'polite');
		errorDiv.setAttribute('role', 'alert');
		
		let retryButton = '';
		if (retryData) {
			retryButton = `
				<button class="panoramic-retry-btn" style="
					margin-top: 1rem;
					padding: 0.5rem 1rem;
					background: #007cba;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				">Try Again</button>
			`;
		}
		
		errorDiv.innerHTML = `
			<div style="color: #d63638; text-align: center; margin: 1em 0; padding: 1em; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
				<strong>Loading Error</strong><br>
				${message}
				${retryButton}
			</div>
		`;
		
		// Add retry functionality
		if (retryData) {
			const retryBtn = errorDiv.querySelector('.panoramic-retry-btn');
			retryBtn.addEventListener('click', async () => {
				errorDiv.remove();
				try {
					await this.openViewer(retryData.thumbnail);
				} catch (retryError) {
					console.error('Retry failed:', retryError);
					this.accessibility.announceContextualError(errorType, false);
					this.showError('Retry failed. Please refresh the page and try again.', errorType);
				}
			});
		}
		
		this.modal.querySelector('.panoramic-viewer-container').prepend(errorDiv);
	}

	/**
	 * Show simple error message (legacy method)
	 */
	showSimpleError(message) {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'panoramic-error';
		errorDiv.setAttribute('aria-live', 'polite');
		errorDiv.textContent = message;
		errorDiv.style.cssText = 'color: red; text-align: center; margin: 1em 0;';
		this.modal.querySelector('.panoramic-viewer-container').prepend(errorDiv);
	}

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
	 * Handle modal keydown events (especially Escape key)
	 */
	handleModalKeydown(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.close();
		}
	}

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

// Add screen reader only styles
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
