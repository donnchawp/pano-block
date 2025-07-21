class PanoramicViewer {
	constructor() {
		this.modal = null;
		this.canvas = null;
		this.ctx = null;
		this.images = [];
		this.stitchedCanvas = null;
		this.isDragging = false;
		this.startX = 0;
		this.startY = 0;
		this.scale = 1;
		this.minScale = 0.5;
		this.maxScale = 3;
		this.panX = 0;
		this.panY = 0;
		this._renderScheduled = false;
		this._lastImageUrls = null;

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
		this.modal.className = 'pano-modal';
		this.modal.setAttribute( 'role', 'dialog' );
		this.modal.setAttribute( 'aria-modal', 'true' );
		this.modal.setAttribute( 'aria-labelledby', 'pano-viewer-title' );

		this.modal.innerHTML = `
            <div class="pano-viewer-container">
                <button class="pano-close" aria-label="Close panoramic viewer" title="Close (Esc)">&times;</button>
                <h2 id="pano-viewer-title" class="sr-only">Panoramic Image Viewer</h2>
                <div class="pano-viewer" role="img" tabindex="0" aria-describedby="pano-instructions">
                    <canvas></canvas>
                </div>
                <div class="pano-controls">
                    <button class="pano-zoom-out" aria-label="Zoom out" title="Zoom out (-)">-</button>
                    <button class="pano-zoom-reset" aria-label="Reset zoom" title="Reset zoom (0)">Reset</button>
                    <button class="pano-zoom-in" aria-label="Zoom in" title="Zoom in (+)">+</button>
                </div>
                <div id="pano-instructions" class="sr-only">
                    Use arrow keys or drag to pan the image. Use + and - keys or controls to zoom.
                </div>
            </div>
        `;

		document.body.appendChild( this.modal );

		// Cache frequently used elements
		this.canvas = this.modal.querySelector( 'canvas' );
		this.ctx = this.canvas.getContext( '2d' );
		this.viewer = this.modal.querySelector( '.pano-viewer' );
		this.closeBtn = this.modal.querySelector( '.pano-close' );
		this.zoomInBtn = this.modal.querySelector( '.pano-zoom-in' );
		this.zoomOutBtn = this.modal.querySelector( '.pano-zoom-out' );
		this.zoomResetBtn = this.modal.querySelector( '.pano-zoom-reset' );
		this.titleEl = this.modal.querySelector( '#pano-viewer-title' );

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
		document.addEventListener( 'DOMContentLoaded', () => {
			const thumbnails = document.querySelectorAll(
				'.pano-block-thumbnail'
			);
			thumbnails.forEach( ( thumbnail ) => {
				thumbnail.addEventListener( 'click', ( e ) =>
					this.openViewer( e.currentTarget )
				);
				thumbnail.addEventListener( 'keydown', ( e ) => {
					if ( e.key === 'Enter' || e.key === ' ' ) {
						e.preventDefault();
						this.openViewer( e.currentTarget );
					}
				} );
			} );
		} );
	}

	async openViewer( thumbnail ) {
		const imagesData = JSON.parse( thumbnail.dataset.images );
		const altText = thumbnail.dataset.alt;

		// Update modal title
		this.titleEl.textContent = altText || 'Panoramic Image Viewer';

		// Check if images have changed
		const imageUrls = imagesData.map(img => img.url);
		const shouldRestitch = !this._lastImageUrls || this._lastImageUrls.length !== imageUrls.length || this._lastImageUrls.some((url, i) => url !== imageUrls[i]);

		if (shouldRestitch) {
			await this.loadImages(imagesData);
			await this.stitchImages();
			this._lastImageUrls = imageUrls;
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

		// Only remove event listeners if destroying the modal, not on close
		// (Keep modal event listeners attached for modal lifetime)

		// Restore focus
		if (this.previousFocus) {
			this.previousFocus.focus();
		}
	}

	async loadImages( imagesData ) {
		this.images = await Promise.all(
			imagesData.map( ( imgData ) => {
				return new Promise( ( resolve, reject ) => {
					const img = new Image();
					img.crossOrigin = 'anonymous';
					img.onload = () => resolve( img );
					img.onerror = reject;
					img.src = imgData.url;
				} );
			} )
		);
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

		this.scheduleRender();
	}

	render() {
		if ( ! this.stitchedCanvas ) return;

		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Calculate image dimensions at current scale
		const scaledWidth = this.stitchedCanvas.width * this.scale;
		const scaledHeight = this.stitchedCanvas.height * this.scale;

		// Center the image and apply pan
		const x = ( this.canvas.width - scaledWidth ) / 2 + this.panX;
		const y = ( this.canvas.height - scaledHeight ) / 2 + this.panY;

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
	}

	scheduleRender() {
		if (!this._renderScheduled) {
			this._renderScheduled = true;
			requestAnimationFrame(() => {
				this._renderScheduled = false;
				this.render();
			});
		}
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
		this.startPan(e.clientX, e.clientY);
	}
	drag(e) {
		this.dragPan(e.clientX, e.clientY);
	}
	endDrag() {
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
		const newScale = Math.max(
			this.minScale,
			Math.min( this.maxScale, this.scale * factor )
		);

		if ( newScale !== this.scale ) {
			this.scale = newScale;
			this.constrainPan();
			this.scheduleRender();
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
		const focusableElements = this.modal.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const firstElement = focusableElements[ 0 ];
		const lastElement = focusableElements[ focusableElements.length - 1 ];

		this.modal.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Tab' ) {
				if ( e.shiftKey ) {
					if ( document.activeElement === firstElement ) {
						e.preventDefault();
						lastElement.focus();
					}
				} else {
					if ( document.activeElement === lastElement ) {
						e.preventDefault();
						firstElement.focus();
					}
				}
			}
		} );
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

// Initialize viewer
new PanoramicViewer();
