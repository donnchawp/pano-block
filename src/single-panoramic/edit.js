import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	MediaUpload,
	MediaUploadCheck,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	Button,
	PanelBody,
	TextControl,
	Placeholder,
} from '@wordpress/components';

export default function Edit( { attributes, setAttributes } ) {
	const { image, altText } = attributes;

	const onSelectImage = ( media ) => {
		const selectedImage = {
			id: media.id,
			url: media.url,
			alt: media.alt || '',
		};
		setAttributes( { image: selectedImage } );
	};

	const removeImage = () => {
		setAttributes( { image: {} } );
	};

	const blockProps = useBlockProps();

	if ( ! image.url ) {
		return (
			<div { ...blockProps }>
				<Placeholder
					icon="format-image"
					label={ __( 'Single Panoramic Image Block', 'panoramic-image-block' ) }
					instructions={ __( 'Select a single panoramic image to display with interactive viewer.', 'panoramic-image-block' ) }
				>
					<MediaUploadCheck>
						<MediaUpload
							onSelect={ onSelectImage }
							allowedTypes={ [ 'image' ] }
							value={ image.id }
							render={ ( { open } ) => (
								<Button variant="primary" onClick={ open }>
									{ __( 'Select Panoramic Image', 'panoramic-image-block' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
				</Placeholder>
			</div>
		);
	}

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Image Settings', 'panoramic-image-block' ) }>
					<TextControl
						label={ __( 'Alt Text', 'panoramic-image-block' ) }
						value={ altText }
						onChange={ ( value ) => setAttributes( { altText: value } ) }
						help={ __( 'Describe the panoramic image for screen readers.', 'panoramic-image-block' ) }
					/>
					<Button
						variant="secondary"
						isDestructive
						onClick={ removeImage }
					>
						{ __( 'Remove Image', 'panoramic-image-block' ) }
					</Button>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<div className="single-panoramic-image-block-container">
					<div className="single-panoramic-image-preview">
						<img
							src={ image.url }
							alt={ altText || image.alt || __( 'Panoramic image preview', 'panoramic-image-block' ) }
							style={ {
								width: '100%',
								height: 'auto',
								maxHeight: '300px',
								objectFit: 'cover',
								borderRadius: '4px',
							} }
						/>
						<div className="single-panoramic-play-overlay">
							<span className="single-panoramic-play-icon" aria-hidden="true">⚬</span>
						</div>
					</div>

					<div className="single-panoramic-controls">
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ onSelectImage }
								allowedTypes={ [ 'image' ] }
								value={ image.id }
								render={ ( { open } ) => (
									<Button variant="secondary" onClick={ open }>
										{ __( 'Replace Image', 'panoramic-image-block' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					</div>
				</div>
			</div>
		</>
	);
}