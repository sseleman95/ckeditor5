/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { Model } from '../../src/model/model.js';
import { ModelElement } from '../../src/model/element.js';
import { ModelText } from '../../src/model/text.js';
import { ModelPosition } from '../../src/model/position.js';
import { ModelLiveRange } from '../../src/model/liverange.js';
import { testUtils } from '@ckeditor/ckeditor5-core/tests/_utils/utils.js';
import { _setModelData } from '../../src/dev-utils/model.js';

import { stringifyBlocks } from '../model/_utils/utils.js';

describe( '#11585', () => {
	let model, doc, root, liveRange;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		model = new Model();
		doc = model.document;
		root = doc.createRoot();
		root._appendChild( [
			new ModelElement( 'p' ),
			new ModelElement( 'p' ),
			new ModelElement( 'p', [], new ModelText( 'foobar' ) ),
			new ModelElement( 'p' ),
			new ModelElement( 'p' ),
			new ModelElement( 'p' ),
			new ModelElement( 'p', [], new ModelText( 'foobar' ) )
		] );

		liveRange = new ModelLiveRange( new ModelPosition( root, [ 0 ] ), new ModelPosition( root, [ 1 ] ) );

		model.schema.register( 'p', { inheritAllFrom: '$block' } );
		model.schema.register( 'h', { inheritAllFrom: '$block' } );

		model.schema.register( 'blockquote' );
		model.schema.extend( 'blockquote', { allowIn: '$root' } );
		model.schema.extend( '$block', { allowIn: 'blockquote' } );

		model.schema.register( 'imageBlock', {
			allowIn: [ '$root', '$block' ],
			allowChildren: '$text'
		} );

		// Special block which can contain another blocks.
		model.schema.register( 'nestedBlock', { inheritAllFrom: '$block' } );
		model.schema.extend( 'nestedBlock', { allowIn: '$block' } );

		model.schema.register( 'table', { isBlock: true, isLimit: true, isObject: true, allowIn: '$root' } );
		model.schema.register( 'tableRow', { allowIn: 'table', isLimit: true } );
		model.schema.register( 'tableCell', { allowIn: 'tableRow', isLimit: true, isSelectable: true } );

		model.schema.extend( 'p', { allowIn: 'tableCell' } );
	} );

	afterEach( () => {
		model.destroy();
		liveRange.detach();
	} );

	it( 'does not return the first block if none of its contents is selected', () => {
		_setModelData( model, '<p>a[</p><p>b</p><p>c]</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [ 'p#b', 'p#c' ] );
	} );

	it( 'returns the first block if at least one of its child nodes is selected', () => {
		_setModelData( model, '<p>a[<imageBlock></imageBlock></p><p>b</p><p>c]</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [ 'p#a', 'p#b', 'p#c' ] );
	} );

	it( 'returns the block if it has a collapsed selection at the beginning', () => {
		_setModelData( model, '<p>[]a</p><p>b</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [ 'p#a' ] );
	} );

	it( 'returns the block if it has a collapsed selection at the end', () => {
		_setModelData( model, '<p>a[]</p><p>b</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [ 'p#a' ] );
	} );

	it( 'does not return first and last blocks if no content is selected', () => {
		_setModelData( model, '<p>a[</p><p>]b</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [] );
	} );

	it( 'returns the first and last blocks if no content is selected but both blocks are empty', () => {
		_setModelData( model, '<p>[</p><p>]</p>' );

		expect( stringifyBlocks( doc.selection.getSelectedBlocks() ) ).to.deep.equal( [ 'p', 'p' ] );
	} );
} );
