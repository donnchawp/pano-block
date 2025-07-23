/**
 * Panoramic Accessibility
 * 
 * Handles accessibility features including screen reader support, ARIA labels, and focus management
 */

export class PanoramicAccessibility {
	constructor(modal, renderer) {
		this.modal = modal;
		this.renderer = renderer;
		
		// Accessibility elements
		this.statusEl = null;
		this.loadingEl = null;
		this.titleEl = null;
		
		// Focus management
		this.previousFocus = null;
		this.trapFocusHandler = null;
		
		this.initializeElements();
	}

	/**
	 * Initialize accessibility elements
	 */
	initializeElements() {
		this.statusEl = this.modal.querySelector('#panoramic-status');
		this.loadingEl = this.modal.querySelector('#panoramic-loading');
		this.titleEl = this.modal.querySelector('#panoramic-viewer-title');
	}

	/**
	 * Show loading state with screen reader announcement
	 */
	showLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'block';
			this.announceStatus('Loading panoramic image...');
		}
	}

	/**
	 * Hide loading state
	 */
	hideLoading() {
		if (this.loadingEl) {
			this.loadingEl.style.display = 'none';
		}
	}

	/**
	 * Announce status to screen readers
	 * @param {string} message - Message to announce
	 * @param {number} clearDelay - Time to clear message (ms)
	 */
	announceStatus(message, clearDelay = 3000) {
		if (this.statusEl) {
			this.statusEl.textContent = message;
			
			// Clear after delay to avoid cluttering screen readers
			if (clearDelay > 0) {
				setTimeout(() => {
					if (this.statusEl) {
						this.statusEl.textContent = '';
					}
				}, clearDelay);
			}
		}
	}

	/**
	 * Announce zoom change
	 * @param {number} oldScale - Previous scale
	 * @param {number} newScale - New scale
	 */
	announceZoomChange(oldScale, newScale) {
		const zoomPercent = Math.round(newScale * 100);
		if (newScale > oldScale) {
			this.announceStatus(`Zoomed in to ${zoomPercent}%`);
		} else {
			this.announceStatus(`Zoomed out to ${zoomPercent}%`);
		}
	}

	/**
	 * Announce view reset
	 * @param {number} scale - Reset scale
	 */
	announceViewReset(scale) {
		const zoomPercent = Math.round(scale * 100);
		this.announceStatus(`View reset. Zoom: ${zoomPercent}%, centered`);
	}

	/**
	 * Announce loading success
	 */
	announceLoadingSuccess() {
		this.announceStatus('Panoramic image loaded successfully');
	}

	/**
	 * Announce loading error
	 */
	announceLoadingError() {
		this.announceStatus('Failed to load panoramic images. Please try again.');
	}

	/**
	 * Update modal title
	 * @param {string} title - New title
	 */
	updateTitle(title) {
		if (this.titleEl) {
			this.titleEl.textContent = title || 'Panoramic Image Viewer';
		}
	}

	/**
	 * Setup focus trapping within modal
	 */
	trapFocus() {
		// Remove any existing trap focus handler
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

	/**
	 * Save current focus and set focus to viewer
	 * @param {HTMLElement} viewer - Viewer element to focus
	 */
	setInitialFocus(viewer) {
		this.previousFocus = document.activeElement;
		if (viewer) {
			viewer.focus();
		}
	}

	/**
	 * Restore focus to previously focused element
	 */
	restoreFocus() {
		if (this.previousFocus) {
			this.previousFocus.focus();
			this.previousFocus = null;
		}
	}

	/**
	 * Remove focus trap
	 */
	removeFocusTrap() {
		if (this.trapFocusHandler) {
			this.modal.removeEventListener('keydown', this.trapFocusHandler);
			this.trapFocusHandler = null;
		}
	}

	/**
	 * Add ARIA live region for dynamic content
	 * @param {string} message - Message to add to live region
	 * @param {string} priority - 'polite' or 'assertive'
	 */
	addLiveRegion(message, priority = 'polite') {
		const liveRegion = document.createElement('div');
		liveRegion.setAttribute('aria-live', priority);
		liveRegion.setAttribute('aria-atomic', 'true');
		liveRegion.className = 'sr-only';
		liveRegion.textContent = message;
		
		this.modal.appendChild(liveRegion);
		
		// Remove after announcement
		setTimeout(() => {
			if (liveRegion.parentNode) {
				liveRegion.parentNode.removeChild(liveRegion);
			}
		}, 1000);
	}

	/**
	 * Update ARIA labels for dynamic content
	 * @param {Object} labels - Object containing label updates
	 */
	updateAriaLabels(labels) {
		Object.keys(labels).forEach(selector => {
			const element = this.modal.querySelector(selector);
			if (element) {
				element.setAttribute('aria-label', labels[selector]);
			}
		});
	}

	/**
	 * Announce keyboard shortcuts
	 */
	announceKeyboardShortcuts() {
		const shortcuts = [
			'Arrow keys: Pan the image',
			'Plus key: Zoom in',
			'Minus key: Zoom out',
			'Zero key: Reset view',
			'Escape key: Close viewer'
		].join('. ');
		
		this.announceStatus(`Keyboard shortcuts available: ${shortcuts}`, 5000);
	}

	/**
	 * Check if screen reader is likely being used
	 * @returns {boolean} Whether screen reader is detected
	 */
	isScreenReaderActive() {
		// Basic heuristics for screen reader detection
		return !!(
			window.navigator.userAgent.match(/NVDA|JAWS|VoiceOver|ORCA/i) ||
			window.speechSynthesis ||
			document.querySelector('[aria-live]')
		);
	}

	/**
	 * Provide enhanced descriptions for screen readers
	 * @param {string} imageType - 'single' or 'multiple'
	 * @param {number} imageCount - Number of images
	 */
	provideImageDescription(imageType, imageCount) {
		let description = '';
		
		if (imageType === 'single') {
			description = 'Single panoramic image viewer. Use controls to zoom and pan around the image.';
		} else {
			description = `Panoramic image created from ${imageCount} stitched images. Use controls to explore the full panoramic view.`;
		}
		
		this.announceStatus(description, 4000);
	}

	/**
	 * Cleanup accessibility resources
	 */
	destroy() {
		this.removeFocusTrap();
		this.restoreFocus();
		
		// Clear any pending status announcements
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