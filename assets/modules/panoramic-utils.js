/**
 * Panoramic Utilities
 * 
 * Shared utilities for image validation, canvas operations, and common functions
 */

export class PanoramicUtils {
	/**
	 * Validate image data structure
	 * @param {Array|Object} data - Image data to validate
	 * @param {string} type - 'single' or 'multiple'
	 * @returns {boolean} Whether data is valid
	 */
	static validateImageData(data, type = 'multiple') {
		if (type === 'single') {
			return data && typeof data === 'object' && data.url;
		}
		
		return Array.isArray(data) && 
			   data.length === 3 && 
			   data.every(img => img && typeof img === 'object' && img.url);
	}

	/**
	 * Load image with timeout and error handling
	 * @param {string} url - Image URL
	 * @param {number} timeout - Timeout in milliseconds
	 * @returns {Promise<HTMLImageElement>} Loaded image
	 */
	static loadImageWithTimeout(url, timeout = 10000) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			let isResolved = false;

			const timer = setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					reject(new Error(`Image load timeout: ${url}`));
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
					reject(new Error(`Image failed to load: ${url}`));
				}
			};

			img.src = url;
		});
	}

	/**
	 * Calculate optimal scale for image to fit container
	 * @param {number} imageWidth - Image width
	 * @param {number} imageHeight - Image height  
	 * @param {number} containerWidth - Container width
	 * @param {number} containerHeight - Container height
	 * @returns {number} Optimal scale factor
	 */
	static calculateOptimalScale(imageWidth, imageHeight, containerWidth, containerHeight) {
		const heightScale = containerHeight / imageHeight;
		const widthScale = containerWidth / imageWidth;
		return Math.min(1, Math.max(heightScale, widthScale));
	}

	/**
	 * Constrain value within bounds
	 * @param {number} value - Value to constrain
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @returns {number} Constrained value
	 */
	static clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	/**
	 * Calculate distance between two points
	 * @param {number} x1 - First point X
	 * @param {number} y1 - First point Y
	 * @param {number} x2 - Second point X
	 * @param {number} y2 - Second point Y
	 * @returns {number} Distance
	 */
	static calculateDistance(x1, y1, x2, y2) {
		const deltaX = x2 - x1;
		const deltaY = y2 - y1;
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	}

	/**
	 * Debounce function calls
	 * @param {Function} func - Function to debounce
	 * @param {number} wait - Wait time in milliseconds
	 * @returns {Function} Debounced function
	 */
	static debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func.apply(this, args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	/**
	 * Throttle function calls
	 * @param {Function} func - Function to throttle
	 * @param {number} limit - Time limit in milliseconds
	 * @returns {Function} Throttled function
	 */
	static throttle(func, limit) {
		let inThrottle;
		return function executedFunction(...args) {
			if (!inThrottle) {
				func.apply(this, args);
				inThrottle = true;
				setTimeout(() => inThrottle = false, limit);
			}
		};
	}

	/**
	 * Generate unique ID
	 * @param {string} prefix - Prefix for ID
	 * @returns {string} Unique ID
	 */
	static generateId(prefix = 'panoramic') {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Deep clone object
	 * @param {Object} obj - Object to clone
	 * @returns {Object} Cloned object
	 */
	static deepClone(obj) {
		if (obj === null || typeof obj !== 'object') return obj;
		if (obj instanceof Date) return new Date(obj.getTime());
		if (obj instanceof Array) return obj.map(item => this.deepClone(item));
		if (typeof obj === 'object') {
			const clonedObj = {};
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					clonedObj[key] = this.deepClone(obj[key]);
				}
			}
			return clonedObj;
		}
	}
}