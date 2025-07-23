import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';

registerBlockType( 'panoramic-image-block/single-panoramic', {
	edit: Edit,
	save,
} );