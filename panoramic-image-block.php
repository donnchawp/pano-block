<?php
/**
 * Plugin Name: Panoramic Image Block
 * Plugin URI: https://github.com/donnchawp/panoramic-image-block
 * Description: A WordPress block to display panoramic images created from 3 images.
 * Version: 1.0.0
 * Author: Donncha O Caoimh
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: panoramic-image-block
 * Requires at least: 6.0
 * Requires PHP: 7.4
 *
 * @package PanoramicImageBlock
 * @version 1.0.0
 * @author Donncha O Caoimh
 * @license GPL v2 or later
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants.
define( 'PANORAMIC_IMAGE_BLOCK_VERSION', '1.0.0' );
define( 'PANORAMIC_IMAGE_BLOCK_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PANORAMIC_IMAGE_BLOCK_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PANORAMIC_IMAGE_BLOCK_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main Panoramic Image Block Plugin Class
 *
 * @since 1.0.0
 */
class Panoramic_Image_Block {

	/**
	 * Plugin instance.
	 *
	 * @since 1.0.0
	 * @var Panoramic_Image_Block
	 */
	private static $instance = null;

	/**
	 * Get plugin instance.
	 *
	 * @since 1.0.0
	 * @return Panoramic_Image_Block
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 */
	private function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize WordPress hooks.
	 *
	 * @since 1.0.0
	 */
	private function init_hooks() {
		add_action( 'init', array( $this, 'panoramic_image_block_register_block' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'panoramic_image_block_enqueue_frontend_scripts' ) );
	}

	/**
	 * Register the blocks.
	 *
	 * @since 1.0.0
	 */
	public function panoramic_image_block_register_block() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		// Register the original panoramic block (3 images)
		register_block_type(
			PANORAMIC_IMAGE_BLOCK_PLUGIN_DIR . 'block.json',
			array(
				'render_callback' => array( $this, 'panoramic_image_block_render_block' ),
			)
		);

		// Register the single panoramic block (1 image)
		register_block_type(
			PANORAMIC_IMAGE_BLOCK_PLUGIN_DIR . 'single-panoramic-block.json',
			array(
				'render_callback' => array( $this, 'single_panoramic_image_block_render_block' ),
			)
		);
	}

	/**
	 * Sanitize images data for security.
	 *
	 * @since 1.0.0
	 * @param array $images Array of image data.
	 * @return array Sanitized images data.
	 */
	private function sanitize_images_data( $images ) {
		if ( ! is_array( $images ) ) {
			return array();
		}

		$sanitized = array();
		foreach ( $images as $image ) {
			if ( ! is_array( $image ) ) {
				continue;
			}

			$sanitized_image = array();
			
			// Sanitize ID
			if ( isset( $image['id'] ) ) {
				$sanitized_image['id'] = absint( $image['id'] );
			}
			
			// Sanitize URL
			if ( isset( $image['url'] ) ) {
				$sanitized_image['url'] = esc_url_raw( $image['url'] );
			}
			
			// Sanitize alt text
			if ( isset( $image['alt'] ) ) {
				$sanitized_image['alt'] = sanitize_text_field( $image['alt'] );
			}

			// Only include if we have at least a URL
			if ( ! empty( $sanitized_image['url'] ) ) {
				$sanitized[] = $sanitized_image;
			}
		}

		return $sanitized;
	}

	/**
	 * Render the block on the frontend.
	 *
	 * @since 1.0.0
	 * @param array  $attributes Block attributes.
	 * @param string $content    Block content.
	 * @param object $block      Block object.
	 * @return string Rendered block HTML.
	 */
	public function panoramic_image_block_render_block( $attributes, $content, $block ) {
		if ( empty( $attributes['images'] ) || ! is_array( $attributes['images'] ) || count( $attributes['images'] ) !== 3 ) {
			return '<p>' . esc_html__( 'Please select 3 images to create a panoramic view.', 'panoramic-image-block' ) . '</p>';
		}

		$images = $this->sanitize_images_data( $attributes['images'] );
		$alt_text = sanitize_text_field( $attributes['altText'] ?? '' );

		// Additional validation after sanitization
		if ( count( $images ) !== 3 ) {
			return '<p>' . esc_html__( 'Please select 3 valid images to create a panoramic view.', 'panoramic-image-block' ) . '</p>';
		}
		$block_id = 'panoramic-image-block-' . wp_generate_uuid4();

		// Get the block wrapper attributes to ensure proper width constraints.
		$wrapper_attributes = get_block_wrapper_attributes(
			array(
				'class' => 'panoramic-image-block-container',
				'id'    => $block_id,
			)
		);

		ob_start();
		?>
		<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<div class="panoramic-image-block-thumbnail"
				data-images="<?php echo esc_attr( wp_json_encode( $images ) ); ?>"
				data-alt="<?php echo esc_attr( $alt_text ); ?>"
				role="button"
				tabindex="0"
				aria-label="<?php echo esc_attr( $alt_text ? $alt_text : __( 'Open panoramic image viewer', 'panoramic-image-block' ) ); ?>">

				<!-- 3 images side by side as the main thumbnail -->
				<div style='display: flex; flex-direction: row; gap: 0px;' class="panoramic-images-container">
					<?php foreach ( $images as $index => $image ) : ?>
						<?php
						// Create custom alt text with segment number - properly sanitized
						$segment_alt = $alt_text ? esc_attr( $alt_text . ' (' . ( $index + 1 ) . '/3)' ) : '';

						// Determine attachment ID - check direct ID first, then try to find from URL
						$attachment_id = 0;
						if ( isset( $image['id'] ) && $image['id'] ) {
							$attachment_id = $image['id'];
						} elseif ( isset( $image['url'] ) && $image['url'] ) {
							$attachment_id = attachment_url_to_postid( $image['url'] );
						}

						// Only render if we have a valid attachment ID
						if ( $attachment_id ) :
							?>
							<div style="max-width:100%;height:auto;" class="panoramic-image-segment" data-index="<?php echo esc_attr( $index ); ?>">
								<?php
								echo wp_get_attachment_image(
									$attachment_id,
									'large',
									false,
									array(
										'class' => 'panoramic-segment-image',
										'alt'   => $segment_alt, // Already escaped above
									)
								);
								?>
							</div>
							<?php
						endif;
						?>
					<?php endforeach; ?>
				</div>

				<!-- Play overlay for JavaScript interaction -->
				<div class="panoramic-play-overlay">
					<span class="panoramic-play-icon" aria-hidden="true">⚬</span>
				</div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Generate stitched image data.
	 *
	 * @since 1.0.0
	 * @param array $images Array of image URLs.
	 * @return string SVG data URL.
	 */
	private function panoramic_image_block_generate_stitched_image_data( $images ) {
		// Return a data attribute that JavaScript will use to stitch the images.
		// This way we avoid server-side image processing and let the browser handle it.
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
			<rect width="800" height="200" fill="#f0f0f0"/>
			<text x="400" y="100" text-anchor="middle" dominant-baseline="central"
				font-family="Arial, sans-serif" font-size="16" fill="#666">
				' . esc_html__( 'Panoramic Preview (3 images stitched)', 'panoramic-image-block' ) . '
			</text>
		</svg>';

		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}

	/**
	 * Sanitize single image data for security.
	 *
	 * @since 1.0.0
	 * @param array $image Single image data.
	 * @return array Sanitized image data.
	 */
	private function sanitize_single_image_data( $image ) {
		if ( ! is_array( $image ) ) {
			return array();
		}

		$sanitized_image = array();
		
		// Sanitize ID
		if ( isset( $image['id'] ) ) {
			$sanitized_image['id'] = absint( $image['id'] );
		}
		
		// Sanitize URL
		if ( isset( $image['url'] ) ) {
			$sanitized_image['url'] = esc_url_raw( $image['url'] );
		}
		
		// Sanitize alt text
		if ( isset( $image['alt'] ) ) {
			$sanitized_image['alt'] = sanitize_text_field( $image['alt'] );
		}

		return $sanitized_image;
	}

	/**
	 * Render the single panoramic block on the frontend.
	 *
	 * @since 1.0.0
	 * @param array  $attributes Block attributes.
	 * @param string $content    Block content.
	 * @param object $block      Block object.
	 * @return string Rendered block HTML.
	 */
	public function single_panoramic_image_block_render_block( $attributes, $content, $block ) {
		if ( empty( $attributes['image'] ) || ! is_array( $attributes['image'] ) || empty( $attributes['image']['url'] ) ) {
			return '<p>' . esc_html__( 'Please select a panoramic image.', 'panoramic-image-block' ) . '</p>';
		}

		$image = $this->sanitize_single_image_data( $attributes['image'] );
		$alt_text = sanitize_text_field( $attributes['altText'] ?? '' );

		// Additional validation after sanitization
		if ( empty( $image['url'] ) ) {
			return '<p>' . esc_html__( 'Please select a valid panoramic image.', 'panoramic-image-block' ) . '</p>';
		}
		$block_id = 'single-panoramic-image-block-' . wp_generate_uuid4();

		// Get the block wrapper attributes to ensure proper width constraints.
		$wrapper_attributes = get_block_wrapper_attributes(
			array(
				'class' => 'single-panoramic-image-block-container',
				'id'    => $block_id,
			)
		);

		// Determine attachment ID - check direct ID first, then try to find from URL
		$attachment_id = 0;
		if ( isset( $image['id'] ) && $image['id'] ) {
			$attachment_id = $image['id'];
		} elseif ( isset( $image['url'] ) && $image['url'] ) {
			$attachment_id = attachment_url_to_postid( $image['url'] );
		}

		ob_start();
		?>
		<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<div class="single-panoramic-image-block-thumbnail"
				data-image="<?php echo esc_attr( wp_json_encode( $image ) ); ?>"
				data-alt="<?php echo esc_attr( $alt_text ); ?>"
				data-block-type="single"
				role="button"
				tabindex="0"
				aria-label="<?php echo esc_attr( $alt_text ? $alt_text : __( 'Open single panoramic image viewer', 'panoramic-image-block' ) ); ?>">

				<!-- Single panoramic image -->
				<div class="single-panoramic-image-container">
					<?php if ( $attachment_id ) : ?>
						<?php
						echo wp_get_attachment_image(
							$attachment_id,
							'large',
							false,
							array(
								'class' => 'single-panoramic-image',
								'alt'   => esc_attr( $alt_text ? $alt_text : $image['alt'] ),
							)
						);
						?>
					<?php else : ?>
						<img
							src="<?php echo esc_url( $image['url'] ); ?>"
							alt="<?php echo esc_attr( $alt_text ? $alt_text : $image['alt'] ); ?>"
							class="single-panoramic-image"
						/>
					<?php endif; ?>
				</div>

				<!-- Play overlay for JavaScript interaction -->
				<div class="single-panoramic-play-overlay">
					<span class="single-panoramic-play-icon" aria-hidden="true">⚬</span>
				</div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Enqueue frontend scripts and styles.
	 *
	 * @since 1.0.0
	 */
	public function panoramic_image_block_enqueue_frontend_scripts() {
		if ( ! has_block( 'panoramic-image-block/panoramic' ) && ! has_block( 'panoramic-image-block/single-panoramic' ) ) {
			return;
		}

		wp_enqueue_script(
			'panoramic-image-block-viewer',
			PANORAMIC_IMAGE_BLOCK_PLUGIN_URL . 'assets/panoramic-viewer.js',
			array(),
			PANORAMIC_IMAGE_BLOCK_VERSION,
			true
		);

		wp_enqueue_style(
			'panoramic-image-block-style',
			PANORAMIC_IMAGE_BLOCK_PLUGIN_URL . 'build/style-index.css',
			array(),
			PANORAMIC_IMAGE_BLOCK_VERSION
		);

		// Localize script for translations and AJAX.
		wp_localize_script(
			'panoramic-image-block-viewer',
			'panoramicImageBlockData',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'panoramic_image_block_nonce' ),
				'strings' => array(
					'loading' => __( 'Loading panoramic view...', 'panoramic-image-block' ),
					'error'   => __( 'Error loading panoramic view.', 'panoramic-image-block' ),
				),
			)
		);
	}
}

/**
 * Plugin activation hook.
 *
 * @since 1.0.0
 */
function panoramic_image_block_activate() {
	// Add activation logic here if needed.
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'panoramic_image_block_activate' );

/**
 * Plugin deactivation hook.
 *
 * @since 1.0.0
 */
function panoramic_image_block_deactivate() {
	// Add deactivation logic here if needed.
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'panoramic_image_block_deactivate' );

/**
 * Plugin uninstall hook.
 *
 * @since 1.0.0
 */
function panoramic_image_block_uninstall() {
	// Add uninstall logic here if needed.
	// This function is called when the plugin is deleted.
}
register_uninstall_hook( __FILE__, 'panoramic_image_block_uninstall' );

// Initialize the plugin.
Panoramic_Image_Block::get_instance();

