import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';
import './style.css';

registerBlockType( 'pano-block/panoramic', {
	edit: Edit,
	save,
} );