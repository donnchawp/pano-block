import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';
import './style.css';

registerBlockType( 'panoramic-image-block/panoramic', {
	edit: Edit,
	save,
} );
