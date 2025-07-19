class PanoramicViewer {
	constructor() {
		this.modal = null;
		this.canvas = null;
		this.ctx = null;
		this.images = [];
		this.stitchedCanvas = null;
		this.isDragging = false;
		this.startX = 0;
		this.currentX = 0;
		this.scale = 1;
		this.minScale = 0.5;
		this.maxScale = 3;
		this.panX = 0;
		this.panY = 0;

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

		this.canvas = this.modal.querySelector( 'canvas' );
		this.ctx = this.canvas.getContext( '2d' );
		this.viewer = this.modal.querySelector( '.pano-viewer' );

		// Bind modal events
		this.modal
			.querySelector( '.pano-close' )
			.addEventListener( 'click', () => this.close() );
		this.modal
			.querySelector( '.pano-zoom-in' )
			.addEventListener( 'click', () => this.zoom( 1.2 ) );
		this.modal
			.querySelector( '.pano-zoom-out' )
			.addEventListener( 'click', () => this.zoom( 0.8 ) );
		this.modal
			.querySelector( '.pano-zoom-reset' )
			.addEventListener( 'click', () => this.resetView() );

		// Mouse events
		this.viewer.addEventListener( 'mousedown', ( e ) =>
			this.startDrag( e )
		);
		this.viewer.addEventListener( 'mousemove', ( e ) => this.drag( e ) );
		this.viewer.addEventListener( 'mouseup', () => this.endDrag() );
		this.viewer.addEventListener( 'mouseleave', () => this.endDrag() );
		this.viewer.addEventListener( 'wheel', ( e ) => this.handleWheel( e ) );

		// Touch events
		this.viewer.addEventListener( 'touchstart', ( e ) =>
			this.startTouch( e )
		);
		this.viewer.addEventListener( 'touchmove', ( e ) =>
			this.dragTouch( e )
		);
		this.viewer.addEventListener( 'touchend', () => this.endDrag() );

		// Keyboard events
		this.viewer.addEventListener( 'keydown', ( e ) =>
			this.handleKeydown( e )
		);
		this.modal.addEventListener( 'keydown', ( e ) =>
			this.handleModalKeydown( e )
		);

		// Click outside to close
		this.modal.addEventListener( 'click', ( e ) => {
			if ( e.target === this.modal ) {
				this.close();
			}
		} );
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

	async generateThumbnail( thumbnail ) {
		const imagesData = JSON.parse( thumbnail.dataset.images );
		if ( imagesData.length !== 3 ) return;

		try {
			// Load the 3 images
			const images = await Promise.all(
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

			// Create thumbnail canvas
			const canvas = document.createElement( 'canvas' );
			const ctx = canvas.getContext( '2d' );

			// Calculate dimensions for thumbnail (scale down to reasonable size)
			const maxHeight = Math.max(
				...images.map( ( img ) => img.height )
			);
			const totalWidth = images.reduce(
				( sum, img ) => sum + img.width,
				0
			);

			// Create thumbnail with reasonable aspect ratio
			// Limit width to content area and height for better display
			const maxThumbnailWidth = 800;
			const maxThumbnailHeight = 300; // Reasonable height for thumbnail
			const scale = Math.min(
				maxThumbnailWidth / totalWidth,
				maxThumbnailHeight / maxHeight,
				1
			);

			canvas.width = totalWidth * scale;
			canvas.height = maxHeight * scale;

			// Clear canvas with white background to avoid black lines
			ctx.fillStyle = 'white';
			ctx.fillRect( 0, 0, canvas.width, canvas.height );

			// Stitch images with slight overlap to avoid seams
			let x = 0;
			images.forEach( ( img, index ) => {
				const scaledWidth = img.width * scale;
				const scaledHeight = img.height * scale;
				const y = ( canvas.height - scaledHeight ) / 2;

				// Add slight overlap except for first image
				const overlap = index > 0 ? 2 : 0;
				ctx.drawImage(
					img,
					x - overlap,
					y,
					scaledWidth + overlap,
					scaledHeight
				);
				x += scaledWidth;
			} );

			// Replace the placeholder image with stitched image
			const stitchedImg = thumbnail.querySelector(
				'.pano-stitched-image'
			);
			if ( stitchedImg ) {
				stitchedImg.src = canvas.toDataURL( 'image/jpeg', 0.8 );
			}
		} catch ( error ) {
			console.warn( 'Failed to generate panoramic thumbnail:', error );
		}
	}

	async openViewer( thumbnail ) {
		const imagesData = JSON.parse( thumbnail.dataset.images );
		const altText = thumbnail.dataset.alt;

		// Update modal title
		const title = this.modal.querySelector( '#pano-viewer-title' );
		title.textContent = altText || 'Panoramic Image Viewer';

		// Load and stitch images
		await this.loadImages( imagesData );
		await this.stitchImages();

		this.resetView();
		this.modal.classList.add( 'active' );

		// Focus management
		this.previousFocus = document.activeElement;
		this.viewer.focus();

		// Trap focus in modal
		this.trapFocus();

		// Prevent body scroll
		document.body.style.overflow = 'hidden';
	}

	close() {
		this.modal.classList.remove( 'active' );
		document.body.style.overflow = '';

		// Restore focus
		if ( this.previousFocus ) {
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

		// Set canvas to fill the viewer area
		this.canvas.width = viewerRect.width;
		this.canvas.height = viewerRect.height;

		// Calculate optimal scale to show the full image height
		const heightScale = this.canvas.height / this.stitchedCanvas.height;
		const widthScale = this.canvas.width / this.stitchedCanvas.width;

		// Use the smaller scale to fit image within viewer, but allow 100% if image is smaller
		this.scale = Math.min( 1, Math.max( heightScale, widthScale ) );

		// Start centered
		this.panX = 0;
		this.panY = 0;

		this.render();
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

	startDrag( e ) {
		this.isDragging = true;
		this.startX = e.clientX - this.panX;
		this.startY = e.clientY - this.panY;
		this.viewer.classList.add( 'dragging' );
	}

	drag( e ) {
		if ( ! this.isDragging ) return;

		this.panX = e.clientX - this.startX;
		this.panY = e.clientY - this.startY;

		this.constrainPan();
		this.render();
	}

	endDrag() {
		this.isDragging = false;
		this.viewer.classList.remove( 'dragging' );
	}

	startTouch( e ) {
		if ( e.touches.length === 1 ) {
			const touch = e.touches[ 0 ];
			this.isDragging = true;
			this.startX = touch.clientX - this.panX;
			this.startY = touch.clientY - this.panY;
		}
		e.preventDefault();
	}

	dragTouch( e ) {
		if ( ! this.isDragging || e.touches.length !== 1 ) return;

		const touch = e.touches[ 0 ];
		this.panX = touch.clientX - this.startX;
		this.panY = touch.clientY - this.startY;

		this.constrainPan();
		this.render();
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
			this.render();
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
				this.render();
				break;
			case 'ArrowRight':
				e.preventDefault();
				this.panX -= step;
				this.constrainPan();
				this.render();
				break;
			case 'ArrowUp':
				e.preventDefault();
				this.panY += step;
				this.constrainPan();
				this.render();
				break;
			case 'ArrowDown':
				e.preventDefault();
				this.panY -= step;
				this.constrainPan();
				this.render();
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
const srOnlyStyle = document.createElement( 'style' );
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
document.head.appendChild( srOnlyStyle );

// Initialize viewer
new PanoramicViewer();
