class PanoramicViewer {
	constructor() {
		this.modal = null;
		this.canvas = null;
		this.ctx = null;
		this.images = [];
		this.stitchedCanvas = null;
		this.isDragging = false;
		this.isMouseDown = false;
		this.startX = 0;
		this.startY = 0;
		this.initialMouseX = 0;
		this.initialMouseY = 0;
		this.dragThreshold = 5; // pixels to move before starting drag
		this.scale = 1;
		this.minScale = 0.5;
		this.maxScale = 3;
		this.panX = 0;
		this.panY = 0;
		this._renderScheduled = false;
		this._lastImageUrls = null;
		this._renderThrottleTimeout = null;
		this._lastRenderTime = 0;
		this.renderFPS = 60; // Target 60 FPS
		this.renderInterval = 1000 / this.renderFPS;

		// Bind handler methods
		this.handleCloseClick = this.close.bind(this);
		this.handleZoomInClick = () => this.zoom(1.2);
		this.handleZoomOutClick = () => this.zoom(0.8);
		this.handleZoomResetClick = () => this.resetView();
		this.handleViewerMousedown = (e) => this.startDrag(e);
		this.handleViewerMousemove = (e) => this.drag(e);
		this.handleViewerMouseup = () => this.endDrag();
		this.handleViewerMouseleave = () => this.endDrag();
		this.handleViewerWheel = (e) => this.handleWheel(e);
		this.handleViewerTouchstart = (e) => this.startTouch(e);
		this.handleViewerTouchmove = (e) => this.dragTouch(e);
		this.handleViewerTouchend = () => this.endDrag();
		this.handleViewerKeydown = (e) => this.handleKeydown(e);
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
		this.bindEvents();
	}

	createModal() {
		this.modal = document.createElement( 'div' );
		this.modal.className = 'panoramic-modal';
		this.modal.setAttribute( 'role', 'dialog' );
		this.modal.setAttribute( 'aria-modal', 'true' );
		this.modal.setAttribute( 'aria-labelledby', 'panoramic-viewer-title' );

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

		document.body.appendChild( this.modal );

		// Cache frequently used elements
		this.canvas = this.modal.querySelector( 'canvas' );
		this.ctx = this.canvas.getContext( '2d' );
		this.viewer = this.modal.querySelector( '.panoramic-viewer' );
		this.closeBtn = this.modal.querySelector( '.panoramic-close' );
		this.zoomInBtn = this.modal.querySelector( '.panoramic-zoom-in' );
		this.zoomOutBtn = this.modal.querySelector( '.panoramic-zoom-out' );
		this.zoomResetBtn = this.modal.querySelector( '.panoramic-zoom-reset' );
		this.titleEl = this.modal.querySelector( '#panoramic-viewer-title' );
		this.loadingEl = this.modal.querySelector( '#panoramic-loading' );
		this.statusEl = this.modal.querySelector( '#panoramic-status' );

		// Bind modal events
		this.closeBtn.addEventListener('click', this.handleCloseClick);
		this.zoomInBtn.addEventListener('click', this.handleZoomInClick);
		this.zoomOutBtn.addEventListener('click', this.handleZoomOutClick);
		this.zoomResetBtn.addEventListener('click', this.handleZoomResetClick);

		// Mouse events
		this.viewer.addEventListener('mousedown', this.handleViewerMousedown);
		this.viewer.addEventListener('mousemove', this.handleViewerMousemove);
		this.viewer.addEventListener('mouseup', this.handleViewerMouseup);
		this.viewer.addEventListener('mouseleave', this.handleViewerMouseleave);
		this.viewer.addEventListener('wheel', this.handleViewerWheel, { passive: false });

		// Touch events
		this.viewer.addEventListener('touchstart', this.handleViewerTouchstart);
		this.viewer.addEventListener('touchmove', this.handleViewerTouchmove);
		this.viewer.addEventListener('touchend', this.handleViewerTouchend);

		// Keyboard events
		this.viewer.addEventListener('keydown', this.handleViewerKeydown);

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

	async openViewer( thumbnail ) {
		const blockType = thumbnail.dataset.blockType || 'panoramic'; // Default to panoramic for backwards compatibility
		const altText = thumbnail.dataset.alt;

		// Update modal title
		this.titleEl.textContent = altText || 'Panoramic Image Viewer';

		// Remove any previous error message
		const oldError = this.modal.querySelector('.panoramic-error');
		if (oldError) oldError.remove();

		let imagesData;
		let imageUrls;

		if (blockType === 'single') {
			// Handle single panoramic image
			const imageData = JSON.parse( thumbnail.dataset.image );
			imagesData = [imageData]; // Convert single image to array for consistent handling
			imageUrls = [imageData.url];
		} else {
			// Handle panoramic block (3 images)
			imagesData = JSON.parse( thumbnail.dataset.images );
			imageUrls = imagesData.map(img => img.url);
		}

		// Check if images have changed
		const shouldRestitch = !this._lastImageUrls || this._lastImageUrls.length !== imageUrls.length || this._lastImageUrls.some((url, i) => url !== imageUrls[i]);

		if (shouldRestitch) {
			try {
				this.showLoading();
				await this.loadImages(imagesData);
				if (blockType === 'single') {
					await this.setupSingleImage();
				} else {
					await this.stitchImages();
				}
				this._lastImageUrls = imageUrls;
				this.hideLoading();
				this.announceStatus('Panoramic image loaded successfully');
			} catch (err) {
				this.hideLoading();
				this.announceStatus('Failed to load panoramic images. Please try again.');
				const errorDiv = document.createElement('div');
				errorDiv.className = 'panoramic-error';
				errorDiv.setAttribute('aria-live', 'polite');
				errorDiv.textContent = 'Failed to load panoramic images.';
				errorDiv.style.color = 'red';
				errorDiv.style.textAlign = 'center';
				errorDiv.style.margin = '1em 0';
				this.modal.querySelector('.panoramic-viewer-container').prepend(errorDiv);
				return;
			}
		}

		this.resetView();
		this.modal.classList.add('active');

		// Focus management
		this.previousFocus = document.activeElement;
		this.viewer.focus();

		// Trap focus in modal
		this.trapFocus();

		// Add Escape key handler to document
		document.addEventListener('keydown', this.handleModalKeydown);

		// Prevent body scroll
		document.body.style.overflow = 'hidden';
	}

	close() {
		this.modal.classList.remove('active');
		document.body.style.overflow = '';

		// Remove Escape key handler from document
		document.removeEventListener('keydown', this.handleModalKeydown);

		// Cancel any pending renders to prevent memory leaks
		if (this._renderScheduled) {
			this._renderScheduled = false;
		}
		if (this._renderThrottleTimeout) {
			clearTimeout(this._renderThrottleTimeout);
			this._renderThrottleTimeout = null;
		}

		// Reset drag states
		this.isDragging = false;
		this.isMouseDown = false;

		// Restore focus
		if (this.previousFocus) {
			this.previousFocus.focus();
			this.previousFocus = null; // Clear reference
		}
	}

	// Cleanup method for complete destruction
	destroy() {
		// Close modal first
		this.close();

		// Remove all event listeners from modal elements
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
		if (this.viewer) {
			this.viewer.removeEventListener('mousedown', this.handleViewerMousedown);
			this.viewer.removeEventListener('mousemove', this.handleViewerMousemove);
			this.viewer.removeEventListener('mouseup', this.handleViewerMouseup);
			this.viewer.removeEventListener('mouseleave', this.handleViewerMouseleave);
			this.viewer.removeEventListener('wheel', this.handleViewerWheel);
			this.viewer.removeEventListener('touchstart', this.handleViewerTouchstart);
			this.viewer.removeEventListener('touchmove', this.handleViewerTouchmove);
			this.viewer.removeEventListener('touchend', this.handleViewerTouchend);
			this.viewer.removeEventListener('keydown', this.handleViewerKeydown);
		}
		if (this.modal) {
			this.modal.removeEventListener('click', this.handleModalClick);
		}

		// Remove modal from DOM
		if (this.modal && this.modal.parentNode) {
			this.modal.parentNode.removeChild(this.modal);
		}

		// Clear canvas contexts
		if (this.ctx) {
			this.ctx = null;
		}
		if (this.stitchedCanvas) {
			this.stitchedCanvas = null;
		}

		// Clear references
		this.modal = null;
		this.canvas = null;
		this.viewer = null;
		this.images = [];
		this._lastImageUrls = null;
	}

	async loadImages( imagesData ) {
		const TIMEOUT = 10000; // 10 seconds
		this.images = await Promise.all(
			imagesData.map((imgData) => {
				return new Promise((resolve, reject) => {
					const img = new Image();
					img.crossOrigin = 'anonymous';
					let done = false;
					const timer = setTimeout(() => {
						if (!done) {
							done = true;
							reject(new Error('Image load timeout: ' + imgData.url));
						}
					}, TIMEOUT);
					img.onload = () => {
						if (!done) {
							done = true;
							clearTimeout(timer);
							resolve(img);
						}
					};
					img.onerror = () => {
						if (!done) {
							done = true;
							clearTimeout(timer);
							reject(new Error('Image failed to load: ' + imgData.url));
						}
					};
					img.src = imgData.url;
				});
			})
		);
	}

	async setupSingleImage() {
		if ( this.images.length !== 1 ) return;

		const img = this.images[0];

		// Create canvas for single image (no stitching needed)
		this.stitchedCanvas = document.createElement( 'canvas' );
		this.stitchedCanvas.width = img.width;
		this.stitchedCanvas.height = img.height;

		const ctx = this.stitchedCanvas.getContext( '2d' );

		// Clear canvas with white background
		ctx.fillStyle = 'white';
		ctx.fillRect( 0, 0, this.stitchedCanvas.width, this.stitchedCanvas.height );

		// Draw the single image
		ctx.drawImage( img, 0, 0, img.width, img.height );
	}

	async stitchImages() {
		if ( this.images.length !== 3 ) return;

		// Create stitched canvas
		const maxHeight = Math.max(
			...this.images.map( ( img ) => img.height )
		);
		const totalWidth = this.images.reduce(
			( sum, img ) => sum + img.width,
			0
		);

		this.stitchedCanvas = document.createElement( 'canvas' );
		this.stitchedCanvas.width = totalWidth;
		this.stitchedCanvas.height = maxHeight;

		const stitchedCtx = this.stitchedCanvas.getContext( '2d' );

		// Clear canvas with white background
		stitchedCtx.fillStyle = 'white';
		stitchedCtx.fillRect(
			0,
			0,
			this.stitchedCanvas.width,
			this.stitchedCanvas.height
		);

		let x = 0;
		this.images.forEach( ( img, index ) => {
			const y = ( maxHeight - img.height ) / 2;
			// Add slight overlap except for first image
			const overlap = index > 0 ? 2 : 0;
			stitchedCtx.drawImage(
				img,
				x - overlap,
				y,
				img.width + overlap,
				img.height
			);
			x += img.width;
		} );
	}

	resetView() {
		if ( ! this.stitchedCanvas ) return;

		const viewerRect = this.viewer.getBoundingClientRect();

		// Only resize canvas if dimensions have changed
		if (this.canvas.width !== viewerRect.width || this.canvas.height !== viewerRect.height) {
			this.canvas.width = viewerRect.width;
			this.canvas.height = viewerRect.height;
		}

		// Calculate optimal scale to show the full image height
		const heightScale = this.canvas.height / this.stitchedCanvas.height;
		const widthScale = this.canvas.width / this.stitchedCanvas.width;

		// Use the smaller scale to fit image within viewer, but allow 100% if image is smaller
		this.scale = Math.min( 1, Math.max( heightScale, widthScale ) );

		// Start centered
		this.panX = 0;
		this.panY = 0;

		this.renderImmediate();
		
		// Announce reset for accessibility
		const zoomPercent = Math.round(this.scale * 100);
		this.announceStatus(`View reset. Zoom: ${zoomPercent}%, centered`);  
	}

	render() {
		if (!this.stitchedCanvas || !this.ctx || !this.canvas) {
			return;
		}

		try {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

			// Calculate image dimensions at current scale
			const scaledWidth = this.stitchedCanvas.width * this.scale;
			const scaledHeight = this.stitchedCanvas.height * this.scale;

			// Center the image and apply pan
			const x = (this.canvas.width - scaledWidth) / 2 + this.panX;
			const y = (this.canvas.height - scaledHeight) / 2 + this.panY;

			this.ctx.drawImage(
				this.stitchedCanvas,
				0,
				0,
				this.stitchedCanvas.width,
				this.stitchedCanvas.height,
				x,
				y,
				scaledWidth,
				scaledHeight
			);
		} catch (error) {
			console.error('Error rendering panoramic image:', error);
			this.announceStatus('Error displaying image. Please try refreshing.');
		}
	}

	scheduleRender() {
		if (!this._renderScheduled) {
			this._renderScheduled = true;
			requestAnimationFrame((currentTime) => {
				this._renderScheduled = false;
				
				// Throttle rendering to target FPS
				const timeSinceLastRender = currentTime - this._lastRenderTime;
				if (timeSinceLastRender >= this.renderInterval) {
					this._lastRenderTime = currentTime;
					this.render();
				} else {
					// Schedule for next available frame
					this.scheduleRender();
				}
			});
		}
	}

	// Immediate render for critical updates (like initial load, reset view)
	renderImmediate() {
		if (this._renderScheduled) {
			// Cancel pending render
			this._renderScheduled = false;
		}
		this.render();
		this._lastRenderTime = performance.now();
	}

	// Shared pan logic
	startPan(x, y) {
		this.isDragging = true;
		this.startX = x - this.panX;
		this.startY = y - this.panY;
		this.viewer.classList.add('dragging');
	}
	dragPan(x, y) {
		if (!this.isDragging) return;
		this.panX = x - this.startX;
		this.panY = y - this.startY;
		this.constrainPan();
		this.scheduleRender();
	}
	endPan() {
		this.isDragging = false;
		this.viewer.classList.remove('dragging');
	}

	startDrag(e) {
		this.isMouseDown = true;
		this.initialMouseX = e.clientX;
		this.initialMouseY = e.clientY;
		// Don't start panning immediately - wait for movement
	}
	drag(e) {
		if (!this.isMouseDown) return;

		const deltaX = e.clientX - this.initialMouseX;
		const deltaY = e.clientY - this.initialMouseY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Only start dragging if mouse has moved beyond threshold
		if (!this.isDragging && distance > this.dragThreshold) {
			this.startPan(this.initialMouseX, this.initialMouseY);
		}

		if (this.isDragging) {
			e.preventDefault();
			this.dragPan(e.clientX, e.clientY);
		}
	}
	endDrag() {
		this.isMouseDown = false;
		this.endPan();
	}
	startTouch(e) {
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			this.startPan(touch.clientX, touch.clientY);
		}
		e.preventDefault();
	}
	dragTouch(e) {
		if (!this.isDragging || e.touches.length !== 1) return;
		const touch = e.touches[0];
		this.dragPan(touch.clientX, touch.clientY);
		e.preventDefault();
	}

	handleWheel( e ) {
		e.preventDefault();

		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		this.zoom( zoomFactor );
	}

	zoom( factor ) {
		const oldScale = this.scale;
		const newScale = Math.max(
			this.minScale,
			Math.min( this.maxScale, this.scale * factor )
		);

		if ( newScale !== this.scale ) {
			this.scale = newScale;
			this.constrainPan();
			this.scheduleRender();
			
			// Announce zoom change for accessibility
			const zoomPercent = Math.round(this.scale * 100);
			if (newScale > oldScale) {
				this.announceStatus(`Zoomed in to ${zoomPercent}%`);
			} else {
				this.announceStatus(`Zoomed out to ${zoomPercent}%`);
			}
		}
	}

	// Accessibility helper methods
	showLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'block';
		}
	}

	hideLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'none';
		}
	}

	announceStatus(message) {
		if (this.statusEl) {
			this.statusEl.textContent = message;
			// Clear after 3 seconds to avoid cluttering screen readers
			setTimeout(() => {
				if (this.statusEl) {
					this.statusEl.textContent = '';
				}
			}, 3000);
		}
	}

	constrainPan() {
		if ( ! this.stitchedCanvas ) return;

		const scaledWidth = this.stitchedCanvas.width * this.scale;
		const scaledHeight = this.stitchedCanvas.height * this.scale;

		// Calculate how much we can pan based on scaled image size vs canvas size
		const maxPanX = Math.max( 0, ( scaledWidth - this.canvas.width ) / 2 );
		const maxPanY = Math.max(
			0,
			( scaledHeight - this.canvas.height ) / 2
		);

		this.panX = Math.max( -maxPanX, Math.min( maxPanX, this.panX ) );
		this.panY = Math.max( -maxPanY, Math.min( maxPanY, this.panY ) );
	}

	handleKeydown( e ) {
		const step = 20;

		switch ( e.key ) {
			case 'ArrowLeft':
				e.preventDefault();
				this.panX += step;
				this.constrainPan();
				this.scheduleRender();
				break;
			case 'ArrowRight':
				e.preventDefault();
				this.panX -= step;
				this.constrainPan();
				this.scheduleRender();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.panY += step;
				this.constrainPan();
				this.scheduleRender();
				break;
			case 'ArrowDown':
				e.preventDefault();
				this.panY -= step;
				this.constrainPan();
				this.scheduleRender();
				break;
			case '+':
			case '=':
				e.preventDefault();
				this.zoom( 1.2 );
				break;
			case '-':
				e.preventDefault();
				this.zoom( 0.8 );
				break;
			case '0':
				e.preventDefault();
				this.resetView();
				break;
		}
	}

	handleModalKeydown( e ) {
		if ( e.key === 'Escape' ) {
			e.preventDefault();
			this.close();
		}
	}

	trapFocus() {
		// Remove any existing trap focus handler
		if (this.trapFocusHandler) {
			this.modal.removeEventListener('keydown', this.trapFocusHandler);
		}

		const focusableElements = this.modal.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
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

// Export PanoramicViewer for explicit initialization
window.PanoramicViewer = PanoramicViewer;

// Optionally, provide a global function to initialize the viewer if needed
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
