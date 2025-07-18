/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { ModelTestEditor } from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor.js';
import { SelectAllEditing } from '../src/selectallediting.js';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph/src/paragraph.js';
import { ImageBlockEditing } from '@ckeditor/ckeditor5-image/src/image/imageblockediting.js';
import { ImageCaptionEditing } from '@ckeditor/ckeditor5-image/src/imagecaption/imagecaptionediting.js';
import { TableEditing } from '@ckeditor/ckeditor5-table/src/tableediting.js';
import { _setModelData, _getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model.js';

describe( 'SelectAllCommand', () => {
	let editor, model, command;

	beforeEach( () => {
		return ModelTestEditor
			.create( {
				plugins: [ SelectAllEditing, Paragraph, ImageBlockEditing, ImageCaptionEditing, TableEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				command = editor.commands.get( 'selectAll' );
			} );
	} );

	afterEach( () => {
		return editor.destroy();
	} );

	describe( 'constructor()', () => {
		it( 'sets public properties', () => {
			expect( command ).to.have.property( 'affectsData', false );
		} );
	} );

	describe( 'isEnabled', () => {
		it( 'should always be "true" because the command is stateless', () => {
			expect( command.isEnabled ).to.be.true;
		} );

		it( 'should not depend on editor read-only state', () => {
			editor.enableReadOnlyMode( 'unit-test' );

			expect( command.isEnabled ).to.be.true;
		} );
	} );

	describe( 'execute()', () => {
		it( 'should select all (collapsed selection in a block with text)', () => {
			_setModelData( model, '<paragraph>f[]oo</paragraph>' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal( '<paragraph>[foo]</paragraph>' );
		} );

		it( 'should select all (collapsed selection in a content with an object)', () => {
			_setModelData( model, '<paragraph>fo[]o</paragraph><imageBlock src="foo.png"><caption></caption></imageBlock>' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>[foo</paragraph><imageBlock src="foo.png"><caption></caption></imageBlock>]'
			);
		} );

		it( 'should select all (selection on an object)', () => {
			_setModelData( model, '<paragraph>foo</paragraph>[<imageBlock src="foo.png"><caption></caption></imageBlock>]' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>[foo</paragraph><imageBlock src="foo.png"><caption></caption></imageBlock>]'
			);
		} );

		it( 'should select all (collapsed selection in a nested editable)', () => {
			_setModelData( model, '<paragraph>foo</paragraph><imageBlock src="foo.png"><caption>b[]ar</caption></imageBlock>' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>foo</paragraph><imageBlock src="foo.png"><caption>[bar]</caption></imageBlock>' );
		} );

		it( 'should select all (selection in a nested editable)', () => {
			_setModelData( model, '<paragraph>foo</paragraph><imageBlock src="foo.png"><caption>b[ar]</caption></imageBlock>' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>foo</paragraph><imageBlock src="foo.png"><caption>[bar]</caption></imageBlock>' );
		} );

		it( 'should select all (selection within limit element)', () => {
			_setModelData( model,
				'<paragraph>foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
						'</tableCell>' +
						'[<tableCell>' +
							'<paragraph>bar</paragraph>' +
						'</tableCell>]' +
						'[<tableCell>' +
							'<paragraph>baz</paragraph>' +
						'</tableCell>]' +
					'</tableRow>' +
				'</table>'
			);

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>[foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
						'</tableCell>' +
						'<tableCell>' +
							'<paragraph>bar</paragraph>' +
						'</tableCell>' +
						'<tableCell>' +
							'<paragraph>baz</paragraph>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>]'
			);
		} );

		it( 'should select all in the closest nested editable (nested editable inside another nested editable)', () => {
			_setModelData( model,
				'<paragraph>foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>b[]ar</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>'
			);

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal( '<paragraph>foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>[bar]</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>'
			);
		} );

		it( 'should select all in the parent select-all-limit element (the entire editable is selected)', () => {
			_setModelData( model, '<paragraph>foo</paragraph><imageBlock src="foo.png"><caption>[bar]</caption></imageBlock>' );

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal(
				'<paragraph>[foo</paragraph><imageBlock src="foo.png"><caption>bar</caption></imageBlock>]' );
		} );

		it( 'should select all in the parent sellect-all-limit element (consecutive execute() on a nested editable)', () => {
			_setModelData( model,
				'<paragraph>foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>b[]ar</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>'
			);

			editor.execute( 'selectAll' );
			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal( '<paragraph>foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>[foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>bar</caption></imageBlock>]' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>'
			);

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal( '<paragraph>[foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>bar</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>]'
			);
		} );

		it( 'should not change the selection (the entire editor is selected)', () => {
			_setModelData( model,
				'<paragraph>[foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>bar</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>]'
			);

			editor.execute( 'selectAll' );

			expect( _getModelData( model ) ).to.equal( '<paragraph>[foo</paragraph>' +
				'<table>' +
					'<tableRow>' +
						'<tableCell>' +
							'<paragraph>foo</paragraph>' +
							'<imageBlock src="foo.png"><caption>bar</caption></imageBlock>' +
						'</tableCell>' +
					'</tableRow>' +
				'</table>]'
			);
		} );
	} );
} );
