<?php
/**
 * Plugin Name: Panoramic Image Block
 * Plugin URI: https://github.com/donnchawp/pano-block
 * Description: A WordPress block to display panoramic images created from 3 images.
 * Version: 1.0.0
 * Author: Donncha O Caoimh
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: pano-block
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
define( 'PANO_BLOCK_VERSION', '1.0.0' );
define( 'PANO_BLOCK_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PANO_BLOCK_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PANO_BLOCK_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Main Pano Block Plugin Class
 *
 * @since 1.0.0
 */
class Pano_Block {

	/**
	 * Plugin instance.
	 *
	 * @since 1.0.0
	 * @var Pano_Block
	 */
	private static $instance = null;

	/**
	 * Get plugin instance.
	 *
	 * @since 1.0.0
	 * @return Pano_Block
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
		add_action( 'init', array( $this, 'pano_block_register_block' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'pano_block_enqueue_frontend_scripts' ) );
		add_action( 'plugins_loaded', array( $this, 'pano_block_load_textdomain' ) );
	}

	/**
	 * Load plugin textdomain.
	 *
	 * @since 1.0.0
	 */
	public function pano_block_load_textdomain() {
		load_plugin_textdomain(
			'pano-block',
			false,
			dirname( PANO_BLOCK_PLUGIN_BASENAME ) . '/languages'
		);
	}

	/**
	 * Register the block.
	 *
	 * @since 1.0.0
	 */
	public function pano_block_register_block() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		register_block_type(
			PANO_BLOCK_PLUGIN_DIR . 'block.json',
			array(
				'render_callback' => array( $this, 'pano_block_render_block' ),
			)
		);
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
	public function pano_block_render_block( $attributes, $content, $block ) {
		if ( empty( $attributes['images'] ) || ! is_array( $attributes['images'] ) || count( $attributes['images'] ) !== 3 ) {
			return '<p>' . esc_html__( 'Please select 3 images to create a panoramic view.', 'pano-block' ) . '</p>';
		}

		$images = $attributes['images'];
		$alt_text = sanitize_text_field( $attributes['altText'] ?? '' );
		$block_id = 'pano-block-' . wp_generate_uuid4();

		// Get the block wrapper attributes to ensure proper width constraints.
		$wrapper_attributes = get_block_wrapper_attributes(
			array(
				'class' => 'pano-block-container',
				'id'    => $block_id,
			)
		);

		ob_start();
		?>
		<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<div class="pano-block-thumbnail"
				data-images="<?php echo esc_attr( wp_json_encode( $images ) ); ?>"
				data-alt="<?php echo esc_attr( $alt_text ); ?>"
				role="button"
				tabindex="0"
				aria-label="<?php echo esc_attr( $alt_text ? $alt_text : __( 'Open panoramic image viewer', 'pano-block' ) ); ?>">
				
				<!-- 3 images side by side as the main thumbnail -->
				<div class="pano-images-container">
					<?php foreach ( $images as $index => $image ) : ?>
						<?php 
						// Create custom alt text with segment number
						$segment_alt = $alt_text ? $alt_text . ' (' . ( $index + 1 ) . '/3)' : '';
						
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
							<div class="pano-image-segment" data-index="<?php echo esc_attr( $index ); ?>">
								<?php
								echo wp_get_attachment_image(
									$attachment_id,
									'large',
									false,
									array(
										'class' => 'pano-segment-image',
										'alt'   => $segment_alt,
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
				<div class="pano-play-overlay">
					<span class="pano-play-icon" aria-hidden="true">⚬</span>
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
	private function pano_block_generate_stitched_image_data( $images ) {
		// Return a data attribute that JavaScript will use to stitch the images.
		// This way we avoid server-side image processing and let the browser handle it.
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
			<rect width="800" height="200" fill="#f0f0f0"/>
			<text x="400" y="100" text-anchor="middle" dominant-baseline="central" 
				font-family="Arial, sans-serif" font-size="16" fill="#666">
				' . esc_html__( 'Panoramic Preview (3 images stitched)', 'pano-block' ) . '
			</text>
		</svg>';

		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}

	/**
	 * Enqueue frontend scripts and styles.
	 *
	 * @since 1.0.0
	 */
	public function pano_block_enqueue_frontend_scripts() {
		if ( ! has_block( 'pano-block/panoramic' ) ) {
			return;
		}

		wp_enqueue_script(
			'pano-block-viewer',
			PANO_BLOCK_PLUGIN_URL . 'assets/panoramic-viewer.js',
			array(),
			PANO_BLOCK_VERSION,
			true
		);

		wp_enqueue_style(
			'pano-block-style',
			PANO_BLOCK_PLUGIN_URL . 'build/style-index.css',
			array(),
			PANO_BLOCK_VERSION
		);

		// Localize script for translations and AJAX.
		wp_localize_script(
			'pano-block-viewer',
			'panoBlockData',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'pano_block_nonce' ),
				'strings' => array(
					'loading' => __( 'Loading panoramic view...', 'pano-block' ),
					'error'   => __( 'Error loading panoramic view.', 'pano-block' ),
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
function pano_block_activate() {
	// Add activation logic here if needed.
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'pano_block_activate' );

/**
 * Plugin deactivation hook.
 *
 * @since 1.0.0
 */
function pano_block_deactivate() {
	// Add deactivation logic here if needed.
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'pano_block_deactivate' );

/**
 * Plugin uninstall hook.
 *
 * @since 1.0.0
 */
function pano_block_uninstall() {
	// Add uninstall logic here if needed.
	// This function is called when the plugin is deleted.
}
register_uninstall_hook( __FILE__, 'pano_block_uninstall' );

// Initialize the plugin.
Pano_Block::get_instance();