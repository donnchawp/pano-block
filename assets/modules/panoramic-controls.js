/**
 * Panoramic Controls
 * 
 * Handles all user interactions including mouse, touch, and keyboard controls
 */

import { PanoramicUtils } from './panoramic-utils.js';

export class PanoramicControls {
	constructor(viewer, renderer) {
		this.viewer = viewer;
		this.renderer = renderer;
		
		// Interaction state
		this.isDragging = false;
		this.isMouseDown = false;
		this.startX = 0;
		this.startY = 0;
		this.initialMouseX = 0;
		this.initialMouseY = 0;
		this.dragThreshold = 5;
		
		// Touch state
		this.lastTouchDistance = 0;
		this.touchStartScale = 1;
		this.touchStartPanX = 0;
		this.touchStartPanY = 0;
		
		// Bind methods to maintain 'this' context
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

	/**
	 * Attach all event listeners
	 */
	attachEventListeners() {
		// Mouse events
		this.viewer.addEventListener('mousedown', this.handleMouseDown);
		this.viewer.addEventListener('mousemove', this.handleMouseMove);
		this.viewer.addEventListener('mouseup', this.handleMouseUp);
		this.viewer.addEventListener('mouseleave', this.handleMouseLeave);
		this.viewer.addEventListener('wheel', this.handleWheel, { passive: false });

		// Touch events
		this.viewer.addEventListener('touchstart', this.handleTouchStart, { passive: false });
		this.viewer.addEventListener('touchmove', this.handleTouchMove, { passive: false });
		this.viewer.addEventListener('touchend', this.handleTouchEnd);

		// Keyboard events
		this.viewer.addEventListener('keydown', this.handleKeyDown);
	}

	/**
	 * Mouse down handler
	 * @param {MouseEvent} e - Mouse event
	 */
	handleMouseDown(e) {
		this.isMouseDown = true;
		this.initialMouseX = e.clientX;
		this.initialMouseY = e.clientY;
		this.viewer.classList.add('grabbing');
	}

	/**
	 * Mouse move handler with drag threshold
	 * @param {MouseEvent} e - Mouse event
	 */
	handleMouseMove(e) {
		if (!this.isMouseDown) return;

		const deltaX = e.clientX - this.initialMouseX;
		const deltaY = e.clientY - this.initialMouseY;
		const distance = PanoramicUtils.calculateDistance(
			0, 0, deltaX, deltaY
		);

		// Only start dragging if mouse has moved beyond threshold
		if (!this.isDragging && distance > this.dragThreshold) {
			this.startPan(this.initialMouseX, this.initialMouseY);
		}

		if (this.isDragging) {
			e.preventDefault();
			this.dragPan(e.clientX, e.clientY);
		}
	}

	/**
	 * Mouse up handler
	 */
	handleMouseUp() {
		this.isMouseDown = false;
		this.endPan();
		this.viewer.classList.remove('grabbing');
	}

	/**
	 * Mouse leave handler
	 */
	handleMouseLeave() {
		this.isMouseDown = false;
		this.endPan();
		this.viewer.classList.remove('grabbing');
	}

	/**
	 * Wheel event handler for zoom
	 * @param {WheelEvent} e - Wheel event
	 */
	handleWheel(e) {
		e.preventDefault();
		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		
		// Get mouse position relative to canvas for zoom center
		const rect = this.viewer.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		
		this.zoomAtPoint(zoomFactor, mouseX, mouseY);
	}

	/**
	 * Touch start handler
	 * @param {TouchEvent} e - Touch event
	 */
	handleTouchStart(e) {
		e.preventDefault();
		
		if (e.touches.length === 1) {
			// Single touch - pan
			const touch = e.touches[0];
			this.startPan(touch.clientX, touch.clientY);
		} else if (e.touches.length === 2) {
			// Two finger touch - zoom
			this.startPinchZoom(e.touches);
		}
	}

	/**
	 * Touch move handler
	 * @param {TouchEvent} e - Touch event
	 */
	handleTouchMove(e) {
		e.preventDefault();
		
		if (e.touches.length === 1 && this.isDragging) {
			// Single touch pan
			const touch = e.touches[0];
			this.dragPan(touch.clientX, touch.clientY);
		} else if (e.touches.length === 2) {
			// Two finger pinch zoom
			this.handlePinchZoom(e.touches);
		}
	}

	/**
	 * Touch end handler
	 */
	handleTouchEnd() {
		this.endPan();
		this.lastTouchDistance = 0;
	}

	/**
	 * Keyboard handler
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	handleKeyDown(e) {
		const step = 20;
		let handled = false;

		switch (e.key) {
			case 'ArrowLeft':
				this.renderer.setPan(this.renderer.panX + step, this.renderer.panY);
				handled = true;
				break;
			case 'ArrowRight':
				this.renderer.setPan(this.renderer.panX - step, this.renderer.panY);
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

	/**
	 * Start pan operation
	 * @param {number} x - Starting X coordinate
	 * @param {number} y - Starting Y coordinate
	 */
	startPan(x, y) {
		this.isDragging = true;
		this.startX = x - this.renderer.panX;
		this.startY = y - this.renderer.panY;
		this.viewer.classList.add('dragging');
	}

	/**
	 * Handle pan drag
	 * @param {number} x - Current X coordinate
	 * @param {number} y - Current Y coordinate
	 */
	dragPan(x, y) {
		if (!this.isDragging) return;
		
		const newPanX = x - this.startX;
		const newPanY = y - this.startY;
		this.renderer.setPan(newPanX, newPanY);
	}

	/**
	 * End pan operation
	 */
	endPan() {
		this.isDragging = false;
		this.viewer.classList.remove('dragging');
	}

	/**
	 * Start pinch zoom operation
	 * @param {TouchList} touches - Touch points
	 */
	startPinchZoom(touches) {
		const distance = this.getTouchDistance(touches);
		this.lastTouchDistance = distance;
		this.touchStartScale = this.renderer.scale;
		this.touchStartPanX = this.renderer.panX;
		this.touchStartPanY = this.renderer.panY;
	}

	/**
	 * Handle pinch zoom
	 * @param {TouchList} touches - Touch points
	 */
	handlePinchZoom(touches) {
		if (this.lastTouchDistance === 0) {
			this.startPinchZoom(touches);
			return;
		}

		const currentDistance = this.getTouchDistance(touches);
		const scaleChange = currentDistance / this.lastTouchDistance;
		
		// Calculate zoom center point
		const centerX = (touches[0].clientX + touches[1].clientX) / 2;
		const centerY = (touches[0].clientY + touches[1].clientY) / 2;
		
		const rect = this.viewer.getBoundingClientRect();
		const zoomCenterX = centerX - rect.left;
		const zoomCenterY = centerY - rect.top;
		
		this.zoomAtPoint(scaleChange, zoomCenterX, zoomCenterY);
		this.lastTouchDistance = currentDistance;
	}

	/**
	 * Get distance between two touch points
	 * @param {TouchList} touches - Touch points
	 * @returns {number} Distance between touches
	 */
	getTouchDistance(touches) {
		if (touches.length < 2) return 0;
		
		return PanoramicUtils.calculateDistance(
			touches[0].clientX,
			touches[0].clientY,
			touches[1].clientX,
			touches[1].clientY
		);
	}

	/**
	 * Zoom at specific point
	 * @param {number} factor - Zoom factor
	 * @param {number} pointX - X coordinate of zoom center
	 * @param {number} pointY - Y coordinate of zoom center
	 * @returns {boolean} Whether zoom was applied
	 */
	zoomAtPoint(factor, pointX, pointY) {
		const oldScale = this.renderer.scale;
		const zoomed = this.renderer.zoom(factor);
		
		if (zoomed) {
			// Adjust pan to zoom towards the specified point
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

	/**
	 * Zoom by factor
	 * @param {number} factor - Zoom factor
	 * @returns {boolean} Whether zoom was applied
	 */
	zoom(factor) {
		return this.renderer.zoom(factor);
	}

	/**
	 * Reset view to default
	 */
	resetView() {
		this.renderer.resetView();
	}

	/**
	 * Remove all event listeners
	 */
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

	/**
	 * Cleanup resources
	 */
	destroy() {
		this.removeEventListeners();
		this.viewer = null;
		this.renderer = null;
	}
}