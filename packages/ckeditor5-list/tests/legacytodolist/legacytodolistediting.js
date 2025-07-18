/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { LegacyTodoListEditing } from '../../src/legacytodolist/legacytodolistediting.js';
import { LegacyListEditing } from '../../src/legacylist/legacylistediting.js';
import { BoldEditing } from '@ckeditor/ckeditor5-basic-styles/src/bold/boldediting.js';
import { BlockQuoteEditing } from '@ckeditor/ckeditor5-block-quote/src/blockquoteediting.js';
import { Typing } from '@ckeditor/ckeditor5-typing/src/typing.js';
import { LegacyListCommand } from '../../src/legacylist/legacylistcommand.js';
import { LegacyCheckTodoListCommand } from '../../src/legacytodolist/legacychecktodolistcommand.js';
import { ModelElement } from '@ckeditor/ckeditor5-engine/src/model/element.js';
import { InlineEditableUIView } from '@ckeditor/ckeditor5-ui/src/editableui/inline/inlineeditableuiview.js';
import { LinkEditing } from '@ckeditor/ckeditor5-link/src/linkediting.js';
import { Enter } from '@ckeditor/ckeditor5-enter/src/enter.js';
import { ShiftEnter } from '@ckeditor/ckeditor5-enter/src/shiftenter.js';

import { VirtualTestEditor } from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor.js';
import { ClassicTestEditor } from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor.js';
import { _getModelData, _setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model.js';
import { _getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view.js';
import { getCode } from '@ckeditor/ckeditor5-utils/src/keyboard.js';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph/src/paragraph.js';
import { testUtils } from '@ckeditor/ckeditor5-core/tests/_utils/utils.js';
import { env } from '@ckeditor/ckeditor5-utils';

describe( 'LegacyTodoListEditing', () => {
	let editor, model, modelDoc, modelRoot, view, viewDoc;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		return VirtualTestEditor
			.create( {
				plugins: [ Paragraph, LegacyTodoListEditing, Typing, BoldEditing, BlockQuoteEditing, LinkEditing, Enter, ShiftEnter ]
			} )
			.then( newEditor => {
				editor = newEditor;

				model = editor.model;
				modelDoc = model.document;
				modelRoot = modelDoc.getRoot();

				view = editor.editing.view;
				viewDoc = view.document;

				model.schema.register( 'foo', {
					allowWhere: '$block',
					allowAttributes: [ 'listIndent', 'listType' ],
					isBlock: true,
					isObject: true
				} );
			} );
	} );

	afterEach( () => {
		return editor.destroy();
	} );

	it( 'should have `isOfficialPlugin` static flag set to `true`', () => {
		expect( LegacyTodoListEditing.isOfficialPlugin ).to.be.true;
	} );

	it( 'should have `isPremiumPlugin` static flag set to `false`', () => {
		expect( LegacyTodoListEditing.isPremiumPlugin ).to.be.false;
	} );

	it( 'should load ListEditing', () => {
		expect( LegacyTodoListEditing.requires ).to.have.members( [ LegacyListEditing ] );
	} );

	it( 'should set proper schema rules', () => {
		const todoListItem = new ModelElement( 'listItem', { listType: 'todo' } );
		const bulletedListItem = new ModelElement( 'listItem', { listType: 'bulleted' } );
		const numberedListItem = new ModelElement( 'listItem', { listType: 'numbered' } );
		const paragraph = new ModelElement( 'paragraph' );

		expect( model.schema.checkAttribute( [ '$root', todoListItem ], 'todoListChecked' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', bulletedListItem ], 'todoListChecked' ) ).to.be.false;
		expect( model.schema.checkAttribute( [ '$root', numberedListItem ], 'todoListChecked' ) ).to.be.false;
		expect( model.schema.checkAttribute( [ '$root', paragraph ], 'todoListChecked' ) ).to.be.false;
	} );

	describe( 'commands', () => {
		it( 'should register todoList list command', () => {
			const command = editor.commands.get( 'todoList' );

			expect( command ).to.be.instanceOf( LegacyListCommand );
			expect( command ).to.have.property( 'type', 'todo' );
		} );

		it( 'should create to-do list item and change to paragraph in normal usage flow', () => {
			expect( _getViewData( view ) ).to.equalMarkup( '<p>[]</p>' );
			expect( _getModelData( model ) ).to.equalMarkup( '<paragraph>[]</paragraph>' );

			editor.execute( 'todoList' );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">[]</listItem>' );
			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li><label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">[]</span>' +
					'</li>' +
				'</ul>'
			);

			editor.execute( 'insertText', { text: 'a' } );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">a[]</listItem>' );
			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li><label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">a{}</span>' +
					'</li>' +
				'</ul>'
			);

			editor.execute( 'insertText', { text: 'b' } );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">ab[]</listItem>' );
			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li><label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">ab{}</span>' +
					'</li>' +
				'</ul>'
			);

			editor.execute( 'todoList' );

			expect( _getModelData( model ) ).to.equalMarkup( '<paragraph>ab[]</paragraph>' );
			expect( _getViewData( view ) ).to.equalMarkup( '<p>ab{}</p>' );
		} );

		it( 'should register checkTodoList command', () => {
			expect( editor.commands.get( 'checkTodoList' ) ).to.be.instanceOf( LegacyCheckTodoListCommand );
		} );

		it( 'should register todoListCheck command as an alias for checkTodoList command', () => {
			expect( editor.commands.get( 'todoListCheck' ) ).to.equal( editor.commands.get( 'checkTodoList' ) );
		} );
	} );

	describe( 'editing pipeline', () => {
		it( 'should convert to-do list item', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1</listItem>' +
				'<listItem listType="todo" listIndent="0" todoListChecked="true">2</listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li><label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1</span>' +
					'</li>' +
					'<li><label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">2</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert nested to-do list items', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="todo" listIndent="1">2.1</listItem>' +
				'<listItem listType="todo" listIndent="1">3.1</listItem>' +
				'<listItem listType="todo" listIndent="2">4.2</listItem>' +
				'<listItem listType="todo" listIndent="2">5.2</listItem>' +
				'<listItem listType="todo" listIndent="1">6.1</listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">2.1</span>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">3.1</span>' +
								'<ul class="todo-list">' +
									'<li>' +
										'<label class="todo-list__label" contenteditable="false"></label>' +
										'<span class="todo-list__label__description">4.2</span>' +
									'</li>' +
									'<li>' +
										'<label class="todo-list__label" contenteditable="false"></label>' +
										'<span class="todo-list__label__description">5.2</span>' +
									'</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">6.1</span>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert to-do list items mixed with bulleted list items', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="bulleted" listIndent="0">2.0</listItem>' +
				'<listItem listType="todo" listIndent="1">3.1</listItem>' +
				'<listItem listType="bulleted" listIndent="2">4.2</listItem>' +
				'<listItem listType="todo" listIndent="1">5.1</listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
					'</li>' +
				'</ul>' +
				'<ul>' +
					'<li>2.0' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">3.1</span>' +
								'<ul>' +
									'<li>4.2</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">5.1</span>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert to-do list items mixed with numbered list items', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">2.0</listItem>' +
				'<listItem listType="todo" listIndent="1">3.1</listItem>' +
				'<listItem listType="numbered" listIndent="2">4.2</listItem>' +
				'<listItem listType="todo" listIndent="1">5.1</listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
					'</li>' +
				'</ul>' +
				'<ol>' +
					'<li>2.0' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">3.1</span>' +
								'<ol>' +
									'<li>4.2</li>' +
								'</ol>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">5.1</span>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ol>'
			);
		} );

		it( 'should properly convert list type change #1', () => {
			_setModelData( model,
				'<listItem listType="numbered" listIndent="0">1.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">[]2.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">3.0</listItem>'
			);

			editor.execute( 'todoList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ol>' +
					'<li>1.0</li>' +
				'</ol>' +
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}2.0</span>' +
					'</li>' +
				'</ul>' +
				'<ol>' +
					'<li>3.0</li>' +
				'</ol>'
			);
		} );

		it( 'should properly convert list type change #2', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="todo" listIndent="0">[]2.0</listItem>' +
				'<listItem listType="todo" listIndent="0">3.0</listItem>'
			);

			editor.execute( 'numberedList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">1.0</span>' +
					'</li>' +
				'</ul>' +
				'<ol>' +
					'<li>{}2.0</li>' +
				'</ol>' +
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">3.0</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should properly convert list type change #3', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">[]2.0</listItem>' +
				'<listItem listType="todo" listIndent="0">3.0</listItem>'
			);

			editor.execute( 'bulletedList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">1.0</span>' +
					'</li>' +
				'</ul>' +
				'<ul>' +
					'<li>{}2.0</li>' +
				'</ul>' +
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">3.0</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should properly convert list type change (when next list item is nested)', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">[]2.0</listItem>' +
				'<listItem listType="todo" listIndent="1">3.0</listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">1.0</span>' +
					'</li>' +
				'</ul>' +
				'<ol>' +
					'<li>' +
						'{}2.0' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">3.0</span>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ol>'
			);

			editor.execute( 'todoList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">1.0</span>' +
					'</li>' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}2.0</span>' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label" contenteditable="false"></label>' +
								'<span class="todo-list__label__description">3.0</span>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>'
			);
		} );
		it( 'should properly convert list type change - inner text with attribute', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1[.0</listItem>' +
				'<listItem listType="todo" listIndent="0"><$text bold="true">2.0</$text></listItem>' +
				'<listItem listType="todo" listIndent="0">3.]0</listItem>'
			);

			editor.execute( 'bulletedList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul>' +
				'<li>1{.0</li>' +
				'<li><strong>2.0</strong></li>' +
				'<li>3.}0</li>' +
				'</ul>'
			);
		} );

		it( 'should properly convert list type change - inner text with many attributes', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1[.0</listItem>' +
				'<listItem listType="todo" listIndent="0"><$text bold="true" linkHref="foo">2.0</$text></listItem>' +
				'<listItem listType="todo" listIndent="0">3.]0</listItem>'
			);

			editor.execute( 'bulletedList' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul>' +
				'<li>1{.0</li>' +
				'<li><a href="foo"><strong>2.0</strong></a></li>' +
				'<li>3.}0</li>' +
				'</ul>'
			);
		} );

		it( 'should convert todoListChecked attribute change', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0">1.0</listItem>' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
					'</li>' +
				'</ul>'
			);

			model.change( writer => {
				writer.setAttribute( 'todoListChecked', true, modelRoot.getChild( 0 ) );
			} );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
					'</li>' +
				'</ul>'
			);

			model.change( writer => {
				writer.setAttribute( 'todoListChecked', false, modelRoot.getChild( 0 ) );
			} );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}1.0</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should remove todoListChecked attribute when checked todoListItem is changed to regular list item', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">f[oo</listItem>' +
				'<listItem listType="todo" listIndent="0" todoListChecked="true">fo]o</listItem>'
			);

			editor.execute( 'bulletedList' );

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="bulleted">f[oo</listItem>' +
				'<listItem listIndent="0" listType="bulleted">fo]o</listItem>'
			);
		} );

		it( 'should be overwritable', () => {
			editor.editing.downcastDispatcher.on( 'insert:listItem', ( evt, data, api ) => {
				const { consumable, writer, mapper } = api;

				consumable.consume( data.item, 'insert' );
				consumable.consume( data.item, 'attribute:listType' );
				consumable.consume( data.item, 'attribute:listIndent' );

				const insertPosition = mapper.toViewPosition( model.createPositionBefore( data.item ) );
				const element = writer.createContainerElement( 'test' );

				mapper.bindElements( data.item, element );
				writer.insert( insertPosition, element );
			}, { priority: 'highest' } );

			editor.editing.downcastDispatcher.on( 'insert:$text', ( evt, data, api ) => {
				const { consumable, writer, mapper } = api;

				consumable.consume( data.item, 'insert' );

				const insertPosition = mapper.toViewPosition( model.createPositionBefore( data.item ) );
				const element = writer.createText( data.item.data );

				writer.insert( insertPosition, element );
				mapper.bindElements( data.item, element );
			}, { priority: 'highest' } );

			editor.editing.downcastDispatcher.on( 'attribute:todoListChecked:listItem', ( evt, data, api ) => {
				const { consumable, writer, mapper } = api;

				consumable.consume( data.item, 'attribute:todoListChecked' );

				const viewElement = mapper.toViewElement( data.item );

				writer.addClass( 'checked', viewElement );
			}, { priority: 'highest' } );

			_setModelData( model, '<listItem listType="todo" listIndent="0">Foo</listItem>' );
			expect( _getViewData( view ) ).to.equalMarkup( '<test>{}Foo</test>' );

			model.change( writer => writer.setAttribute( 'todoListChecked', true, modelRoot.getChild( 0 ) ) );
			expect( _getViewData( view ) ).to.equalMarkup( '<test class="checked">{}Foo</test>' );
		} );

		it( 'should render selection after checkmark element in the first text node', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0">Foo</listItem>' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">{}Foo</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should render selection after checkmark element when list item does not contain any text nodes', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0">[]</listItem>' );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">[]</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should render marker UIElements after the checkmark element', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">[]foo</listItem>' +
				'<listItem listType="todo" listIndent="0">bar</listItem>'
			);

			editor.conversion.for( 'downcast' ).markerToElement( {
				model: 'element1',
				view: ( data, { writer } ) => writer.createUIElement( 'element1' )
			} );

			editor.conversion.for( 'downcast' ).markerToElement( {
				model: 'element2',
				view: ( data, { writer } ) => writer.createUIElement( 'element2' )
			} );

			editor.conversion.for( 'downcast' ).markerToHighlight( {
				model: 'highlight',
				view: { classes: 'highlight' }
			} );
			model.change( writer => {
				writer.addMarker( 'element1', {
					range: writer.createRange( writer.createPositionAt( modelRoot.getChild( 0 ), 0 ) ),
					usingOperation: false
				} );

				writer.addMarker( 'element2', {
					range: writer.createRange( writer.createPositionAt( modelRoot.getChild( 0 ), 0 ) ),
					usingOperation: false
				} );

				writer.addMarker( 'highlight', {
					range: writer.createRangeIn( modelRoot.getChild( 0 ) ),
					usingOperation: false
				} );
			} );

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">' +
							'[]<span class="highlight">' +
								'<element2></element2>' +
								'<element1></element1>' +
								'foo' +
							'</span>' +
						'</span>' +
					'</li>' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">bar</span>' +
					'</li>' +
				'</ul>'
			);

			// CC.
			editor.execute( 'checkTodoList' );
		} );

		it( 'should properly handle typing inside text node with attribute', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0"><$text bold="true">[]foo</$text></listItem>' );

			editor.execute( 'insertText', { text: 'b' } );

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="todo"><$text bold="true">b[]foo</$text></listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">' +
							'<strong>b{}foo</strong>' +
						'</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should properly handle typing inside text node with many attributes', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0"><$text bold="true" linkHref="foo">[]foo</$text></listItem>'
			);

			editor.execute( 'insertText', { text: 'b' } );

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="todo"><$text bold="true" linkHref="foo">b[]foo</$text></listItem>'
			);

			expect( _getViewData( view ) ).to.equalMarkup(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label" contenteditable="false"></label>' +
						'<span class="todo-list__label__description">' +
							'<a class="ck-link_selected" href="foo"><strong>b{}foo</strong></a>' +
						'</span>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should properly handle enter key in list item containing soft-breaks', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0">[]Foo<softBreak></softBreak>bar</listItem>' );

			editor.execute( 'enter' );

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="todo"></listItem>' +
				'<listItem listIndent="0" listType="todo">[]Foo<softBreak></softBreak>bar</listItem>'
			);
		} );
	} );

	describe( 'accessibility', () => {
		let announcerSpy, editorElement;

		beforeEach( async () => {
			editorElement = document.createElement( 'div' );
			document.body.appendChild( editorElement );

			return ClassicTestEditor
				.create( editorElement, {
					plugins: [ Paragraph, LegacyTodoListEditing ]
				} )
				.then( newEditor => {
					editor = newEditor;

					model = editor.model;
					modelDoc = model.document;
					modelRoot = modelDoc.getRoot();

					view = editor.editing.view;
					viewDoc = view.document;
					announcerSpy = sinon.spy( editor.ui.ariaLiveAnnouncer, 'announce' );
				} );
		} );

		afterEach( () => {
			editorElement.remove();
			return editor.destroy();
		} );

		it( 'should announce entering and leaving list', () => {
			_setModelData( model,
				'<paragraph>[Foo]</paragraph>' +
				'<listItem listType="todo" listIndent="0">1</listItem>' +
				'<listItem listType="todo" listIndent="0" todoListChecked="true">2</listItem>' +
				'<paragraph>Foo</paragraph>'
			);

			moveSelection( [ 1, 0 ], [ 1, 1 ] );
			expectAnnounce( 'Entering a to-do list' );

			moveSelection( [ 3, 0 ], [ 3, 1 ] );
			expectAnnounce( 'Leaving a to-do list' );
		} );

		it( 'should announce entering and leaving list once, even if there is nested list', () => {
			_setModelData( model,
				'<paragraph>[Foo]</paragraph>' +
				'<listItem listType="todo" listIndent="0">1</listItem>' +
				'<listItem listType="todo" listIndent="1">1</listItem>' +
				'<listItem listType="todo" listIndent="0" todoListChecked="true">2</listItem>' +
				'<paragraph>Foo</paragraph>'
			);

			moveSelection( [ 1, 0 ], [ 1, 1 ] );
			expectAnnounce( 'Entering a to-do list' );

			moveSelection( [ 2, 0 ], [ 2, 1 ] );
			expectNotToAnnounce( 'Leaving a to-do list' );

			moveSelection( [ 4, 0 ], [ 4, 1 ] );
			expectAnnounce( 'Leaving a to-do list' );
		} );

		function expectNotToAnnounce( message ) {
			expect( announcerSpy ).not.to.be.calledWithExactly( message );
		}

		function expectAnnounce( message ) {
			expect( announcerSpy ).to.be.calledWithExactly( message );
		}

		function moveSelection( startPath, endPath ) {
			model.change( writer => {
				writer.setSelection( createRange( modelRoot, startPath, modelRoot, endPath ) );
			} );
		}

		function createRange( startElement, startPath, endElement, endPath ) {
			return model.createRange(
				model.createPositionFromPath( startElement, startPath ),
				model.createPositionFromPath( endElement, endPath )
			);
		}
	} );

	describe( 'data pipeline m -> v', () => {
		it( 'should convert to-do list item', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1</listItem>' +
				'<listItem listType="todo" listIndent="0" todoListChecked="true">2</listItem>'
			);

			expect( editor.getData() ).to.equal(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description">1</span>' +
						'</label>' +
					'</li>' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled" checked="checked">' +
							'<span class="todo-list__label__description">2</span>' +
						'</label>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert nested to-do list item', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="todo" listIndent="1">2.1</listItem>'
			);

			expect( editor.getData() ).to.equal(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description">1.0</span>' +
						'</label>' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">2.1</span>' +
								'</label>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert to-do list item mixed with bulleted list items', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="bulleted" listIndent="0">2.0</listItem>' +
				'<listItem listType="todo" listIndent="1">3.1</listItem>' +
				'<listItem listType="bulleted" listIndent="2">4.2</listItem>' +
				'<listItem listType="todo" listIndent="1">5.1</listItem>'
			);

			expect( editor.getData() ).to.equal(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description">1.0</span>' +
						'</label>' +
					'</li>' +
				'</ul>' +
				'<ul>' +
					'<li>2.0' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">3.1</span>' +
								'</label>' +
								'<ul>' +
									'<li>4.2</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">5.1</span>' +
								'</label>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>'
			);
		} );

		it( 'should convert to-do list item mixed with numbered list items', () => {
			_setModelData( model,
				'<listItem listType="todo" listIndent="0">1.0</listItem>' +
				'<listItem listType="numbered" listIndent="0">2.0</listItem>' +
				'<listItem listType="todo" listIndent="1">3.1</listItem>' +
				'<listItem listType="numbered" listIndent="2">4.2</listItem>' +
				'<listItem listType="todo" listIndent="1">5.1</listItem>'
			);

			expect( editor.getData() ).to.equal(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description">1.0</span>' +
						'</label>' +
					'</li>' +
				'</ul>' +
				'<ol>' +
					'<li>2.0' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">3.1</span>' +
								'</label>' +
								'<ol>' +
									'<li>4.2</li>' +
								'</ol>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">5.1</span>' +
								'</label>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ol>'
			);
		} );

		it( 'should be overwritable', () => {
			editor.data.downcastDispatcher.on( 'insert:listItem', ( evt, data, api ) => {
				const { consumable, writer, mapper } = api;

				consumable.consume( data.item, 'insert' );
				consumable.consume( data.item, 'attribute:listType' );
				consumable.consume( data.item, 'attribute:listIndent' );

				const element = writer.createContainerElement( 'test' );
				const insertPosition = mapper.toViewPosition( model.createPositionBefore( data.item ) );

				writer.insert( insertPosition, element );
				mapper.bindElements( data.item, element );
			}, { priority: 'highest' } );

			editor.data.downcastDispatcher.on( 'insert:$text', ( evt, data, api ) => {
				const { consumable, writer, mapper } = api;

				consumable.consume( data.item, 'insert' );

				const insertPosition = mapper.toViewPosition( model.createPositionBefore( data.item ) );
				const element = writer.createText( data.item.data );

				writer.insert( insertPosition, element );
				mapper.bindElements( data.item, element );
			}, { priority: 'highest' } );

			_setModelData( model, '<listItem listType="todo" listIndent="0">Foo</listItem>' );

			expect( editor.getData() ).to.equal( '<test>Foo</test>' );
		} );

		it( 'should handle links inside to-do list item', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0"><$text linkHref="foo">Foo</$text> Bar</listItem>' );

			expect( editor.getData() ).to.equal(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description"><a href="foo">Foo</a> Bar</span>' +
						'</label>' +
					'</li>' +
				'</ul>'
			);
		} );
	} );

	describe( 'data pipeline v -> m', () => {
		it( 'should convert li with checkbox before the first text node as to-do list item', () => {
			editor.setData( '<ul><li><input type="checkbox">foo</li></ul>' );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">[]foo</listItem>' );
		} );

		it( 'should convert li with checked checkbox as checked to-do list item', () => {
			editor.setData(
				'<ul>' +
					'<li><input type="checkbox" checked="checked">a</li>' +
					'<li><input type="checkbox" checked="anything">b</li>' +
					'<li><input type="checkbox" checked>c</li>' +
				'</ul>'
			);

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="todo" todoListChecked="true">[]a</listItem>' +
				'<listItem listIndent="0" listType="todo" todoListChecked="true">b</listItem>' +
				'<listItem listIndent="0" listType="todo" todoListChecked="true">c</listItem>'
			);
		} );

		it( 'should not convert li with checkbox in the middle of the text', () => {
			editor.setData( '<ul><li>Foo<input type="checkbox">Bar</li></ul>' );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="bulleted">[]FooBar</listItem>' );
		} );

		it( 'should convert li with checkbox wrapped by inline elements when checkbox is before the first text node', () => {
			editor.setData( '<ul><li><label><input type="checkbox">Foo</label></li></ul>' );

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">[]Foo</listItem>' );
		} );

		it( 'should split items with checkboxes - bulleted list', () => {
			editor.setData(
				'<ul>' +
					'<li>foo</li>' +
					'<li><input type="checkbox">bar</li>' +
					'<li>biz</li>' +
				'</ul>'
			);

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="bulleted">[]foo</listItem>' +
				'<listItem listIndent="0" listType="todo">bar</listItem>' +
				'<listItem listIndent="0" listType="bulleted">biz</listItem>'
			);
		} );

		it( 'should split items with checkboxes - numbered list', () => {
			editor.setData(
				'<ol>' +
					'<li>foo</li>' +
					'<li><input type="checkbox">bar</li>' +
					'<li>biz</li>' +
				'</ol>'
			);

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="numbered">[]foo</listItem>' +
				'<listItem listIndent="0" listType="todo">bar</listItem>' +
				'<listItem listIndent="0" listType="numbered">biz</listItem>'
			);
		} );

		it( 'should convert checkbox in nested lists', () => {
			editor.setData(
				'<ul>' +
					'<li>1.1' +
						'<ul>' +
							'<li><input type="checkbox">2.2</li>' +
							'<li>3.2</li>' +
						'</ul>' +
					'</li>' +
					'<li>4.1' +
						'<ol>' +
							'<li>5.2</li>' +
							'<li><input type="checkbox">6.2</li>' +
						'</ol>' +
					'</li>' +
					'<li>7.1</li>' +
				'</ul>'
			);

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="bulleted">[]1.1</listItem>' +
				'<listItem listIndent="1" listType="todo">2.2</listItem>' +
				'<listItem listIndent="1" listType="todo">3.2</listItem>' +
				'<listItem listIndent="0" listType="bulleted">4.1</listItem>' +
				'<listItem listIndent="1" listType="numbered">5.2</listItem>' +
				'<listItem listIndent="1" listType="numbered">6.2</listItem>' +
				'<listItem listIndent="0" listType="bulleted">7.1</listItem>'
			);
		} );

		it( 'should convert to-do list returned by m -> v data pipeline conversion', () => {
			editor.setData(
				'<ul class="todo-list">' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled" checked="checked">' +
							'<span class="todo-list__label__description">1.1</span>' +
						'</label>' +
						'<ul class="todo-list">' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled">' +
									'<span class="todo-list__label__description">2.2</span>' +
								'</label>' +
							'</li>' +
							'<li>' +
								'<label class="todo-list__label">' +
									'<input type="checkbox" disabled="disabled" checked="checked">' +
									'<span class="todo-list__label__description">3.2</span>' +
								'</label>' +
							'</li>' +
						'</ul>' +
					'</li>' +
					'<li>' +
						'<label class="todo-list__label">' +
							'<input type="checkbox" disabled="disabled">' +
							'<span class="todo-list__label__description">4.1</span>' +
						'</label>' +
					'</li>' +
				'</ul>'
			);

			expect( _getModelData( model ) ).to.equalMarkup(
				'<listItem listIndent="0" listType="todo" todoListChecked="true">[]1.1</listItem>' +
				'<listItem listIndent="1" listType="todo">2.2</listItem>' +
				'<listItem listIndent="1" listType="todo" todoListChecked="true">3.2</listItem>' +
				'<listItem listIndent="0" listType="todo">4.1</listItem>'
			);
		} );

		it( 'should be overwritable', () => {
			editor.data.upcastDispatcher.on( 'element:input', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.viewItem, { name: true } );
				conversionApi.writer.setAttribute( 'listType', 'numbered', data.modelCursor.parent );
				data.modelRange = conversionApi.writer.createRange( data.modelCursor );
			}, { priority: 'highest' } );

			editor.setData(
				'<ul>' +
					'<li><input type="checkbox">foo</li>' +
				'</ul>'
			);

			expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="numbered">[]foo</listItem>' );
		} );
	} );

	describe( 'todoListChecked attribute model post-fixer', () => {
		it( 'should remove todoListChecked attribute when checked todoListItem is renamed', () => {
			_setModelData( model, '<listItem listType="todo" listIndent="0" todoListChecked="true">fo[]o</listItem>' );

			editor.execute( 'todoList' );

			expect( _getModelData( model ) ).to.equalMarkup( '<paragraph>fo[]o</paragraph>' );
		} );
	} );

	describe( 'arrow key handling', () => {
		let editor, model, view, viewDoc, domEvtDataStub;

		describe( 'left arrow in a LTR (left–to–right) content', () => {
			beforeEach( () => {
				return VirtualTestEditor
					.create( {
						language: 'en',
						plugins: [ Paragraph, LegacyTodoListEditing, Typing, BoldEditing, BlockQuoteEditing ]
					} )
					.then( newEditor => {
						editor = newEditor;

						model = editor.model;
						view = editor.editing.view;
						viewDoc = view.document;

						model.schema.register( 'foo', {
							allowWhere: '$block',
							allowAttributes: [ 'listIndent', 'listType' ],
							isBlock: true,
							isObject: true
						} );

						domEvtDataStub = {
							keyCode: getCode( 'arrowLeft' ),
							preventDefault: sinon.spy(),
							stopPropagation: sinon.spy(),
							domTarget: {
								ownerDocument: {
									defaultView: {
										getSelection: () => ( { rangeCount: 0 } )
									}
								}
							}
						};
					} );
			} );

			afterEach( async () => {
				await editor.destroy();
			} );

			testArrowKey();
		} );

		describe( 'right arrow in a RTL (left–to–right) content', () => {
			beforeEach( () => {
				return VirtualTestEditor
					.create( {
						language: 'ar',
						plugins: [ Paragraph, LegacyTodoListEditing, Typing, BoldEditing, BlockQuoteEditing ]
					} )
					.then( newEditor => {
						editor = newEditor;

						model = editor.model;
						view = editor.editing.view;
						viewDoc = view.document;

						model.schema.register( 'foo', {
							allowWhere: '$block',
							allowAttributes: [ 'listIndent', 'listType' ],
							isBlock: true,
							isObject: true
						} );

						domEvtDataStub = {
							keyCode: getCode( 'arrowRight' ),
							preventDefault: sinon.spy(),
							stopPropagation: sinon.spy(),
							domTarget: {
								ownerDocument: {
									defaultView: {
										getSelection: () => ( { rangeCount: 0 } )
									}
								}
							}
						};
					} );
			} );

			afterEach( async () => {
				await editor.destroy();
			} );

			testArrowKey();
		} );

		function testArrowKey() {
			it( 'should jump at the end of the previous node when selection is after checkmark element', () => {
				_setModelData( model,
					'<blockQuote><paragraph>foo</paragraph></blockQuote>' +
					'<listItem listIndent="0" listType="todo">[]bar</listItem>'
				);

				viewDoc.fire( 'keydown', domEvtDataStub );

				expect( _getModelData( model ) ).to.equalMarkup(
					'<blockQuote><paragraph>foo[]</paragraph></blockQuote>' +
					'<listItem listIndent="0" listType="todo">bar</listItem>'
				);

				sinon.assert.calledOnce( domEvtDataStub.preventDefault );
				sinon.assert.calledOnce( domEvtDataStub.stopPropagation );
			} );

			it( 'should prevent default handler when list item is a first block element in the root', () => {
				_setModelData( model, '<listItem listIndent="0" listType="todo">[]bar</listItem>' );

				viewDoc.fire( 'keydown', domEvtDataStub );

				sinon.assert.calledOnce( domEvtDataStub.preventDefault );
				sinon.assert.calledOnce( domEvtDataStub.stopPropagation );

				expect( _getModelData( model ) ).to.equalMarkup( '<listItem listIndent="0" listType="todo">[]bar</listItem>' );
			} );

			it( 'should do nothing when selection is not collapsed', () => {
				_setModelData( model, '<listItem listIndent="0" listType="todo">[bar]</listItem>' );

				viewDoc.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			} );

			it( 'should do nothing when selection is not at the beginning list item', () => {
				_setModelData( model, '<listItem listIndent="0" listType="todo">b[]ar</listItem>' );

				viewDoc.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			} );

			it( 'should do nothing when other arrow key was pressed', () => {
				domEvtDataStub.keyCode = getCode( 'arrowUp' );

				_setModelData( model, '<listItem listIndent="0" listType="todo">b[]ar</listItem>' );

				viewDoc.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			} );

			it( 'should do nothing when other arrow key was pressed (the selection is at the beginning of text)', () => {
				_setModelData( model, '<listItem listIndent="0" listType="todo">[]bar</listItem>' );

				domEvtDataStub = {
					keyCode: getCode( 'arrowDown' ),
					preventDefault: sinon.spy(),
					stopPropagation: sinon.spy(),
					domTarget: {
						ownerDocument: {
							defaultView: {
								getSelection: () => ( { rangeCount: 0 } )
							}
						}
					}
				};

				viewDoc.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			} );
		}
	} );

	describe( 'Ctrl+enter keystroke handling', () => {
		it( 'should execute CheckTodoListCommand', () => {
			const command = editor.commands.get( 'checkTodoList' );

			sinon.spy( command, 'execute' );

			const domEvtDataStub = {
				keyCode: getCode( 'enter' ),
				preventDefault: sinon.spy(),
				stopPropagation: sinon.spy()
			};

			if ( env.isMac ) {
				domEvtDataStub.metaKey = true;
			} else {
				domEvtDataStub.ctrlKey = true;
			}

			// First call.
			viewDoc.fire( 'keydown', domEvtDataStub );

			sinon.assert.calledOnce( command.execute );

			// Second call.
			viewDoc.fire( 'keydown', domEvtDataStub );

			sinon.assert.calledTwice( command.execute );
		} );
	} );
} );

describe( 'TodoListEditing - checkbox rendering', () => {
	let editorElement, editor, model, modelDoc, view, viewDoc, viewRoot;

	beforeEach( () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );

		return ClassicTestEditor
			.create( editorElement, {
				plugins: [ Paragraph, LegacyTodoListEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;

				model = editor.model;
				modelDoc = model.document;

				view = editor.editing.view;
				viewDoc = view.document;
				viewRoot = viewDoc.getRoot();
			} );
	} );

	afterEach( () => {
		editorElement.remove();

		return editor.destroy();
	} );

	it( 'should render checkbox inside a checkmark UIElement', () => {
		_setModelData( model, '<listItem listIndent="0" listType="todo">foo</listItem>' );

		const checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );

		expect( checkmarkViewElement.is( 'uiElement' ) ).to.equal( true );

		const checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		const checkboxElement = checkmarkDomElement.children[ 0 ];

		expect( checkboxElement.tagName ).to.equal( 'INPUT' );
		expect( checkboxElement.checked ).to.equal( false );
		expect( checkboxElement.getAttribute( 'tabindex' ) ).to.equal( '-1' );
	} );

	it( 'should render checked checkbox inside a checkmark UIElement', () => {
		_setModelData( model, '<listItem listIndent="0" listType="todo" todoListChecked="true">foo</listItem>' );

		const checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		const checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		const checkboxElement = checkmarkDomElement.children[ 0 ];

		expect( checkboxElement.checked ).to.equal( true );
	} );

	it( 'should toggle `todoListChecked` state using command when click on checkbox element', () => {
		_setModelData( model,
			'<listItem listIndent="0" listType="todo">foo</listItem>' +
			'<paragraph>b[a]r</paragraph>'
		);

		const command = editor.commands.get( 'checkTodoList' );

		sinon.spy( command, 'execute' );

		let checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		let checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		let checkboxElement = checkmarkDomElement.children[ 0 ];

		expect( checkboxElement.checked ).to.equal( false );

		checkboxElement.dispatchEvent( new Event( 'change' ) );

		checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		checkboxElement = checkmarkDomElement.children[ 0 ];

		sinon.assert.calledOnce( command.execute );
		expect( checkboxElement.checked ).to.equal( true );
		expect( _getModelData( model ) ).to.equalMarkup(
			'<listItem listIndent="0" listType="todo" todoListChecked="true">foo</listItem>' +
			'<paragraph>b[a]r</paragraph>'
		);

		checkboxElement.dispatchEvent( new Event( 'change' ) );

		checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		checkboxElement = checkmarkDomElement.children[ 0 ];

		sinon.assert.calledTwice( command.execute );
		expect( checkboxElement.checked ).to.equal( false );
		expect( _getModelData( model ) ).to.equalMarkup(
			'<listItem listIndent="0" listType="todo">foo</listItem>' +
			'<paragraph>b[a]r</paragraph>'
		);
	} );

	it( 'should toggle `todoListChecked` state using command when checkmark was created as a result of changing list type', () => {
		_setModelData( model, '<listItem listIndent="0" listType="numbered">f[]oo</listItem>' );
		editor.execute( 'todoList' );

		const command = editor.commands.get( 'checkTodoList' );

		sinon.spy( command, 'execute' );

		let checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		let checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		let checkboxElement = checkmarkDomElement.children[ 0 ];

		expect( checkboxElement.checked ).to.equal( false );

		checkboxElement.dispatchEvent( new Event( 'change' ) );

		checkmarkViewElement = viewRoot.getChild( 0 ).getChild( 0 ).getChild( 0 );
		checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		checkboxElement = checkmarkDomElement.children[ 0 ];

		sinon.assert.calledOnce( command.execute );
		expect( checkboxElement.checked ).to.equal( true );
		expect( _getModelData( model ) ).to.equalMarkup(
			'<listItem listIndent="0" listType="todo" todoListChecked="true">f[]oo</listItem>'
		);
	} );

	it( 'should toggle `todoListChecked` state using command in root created in a runtime', () => {
		const dynamicRootElement = document.createElement( 'div' );
		const dynamicRootEditable = new InlineEditableUIView( editor.locale, view, dynamicRootElement );

		document.body.appendChild( dynamicRootElement );

		modelDoc.createRoot( '$root', 'dynamicRoot' );
		dynamicRootEditable.name = 'dynamicRoot';
		view.attachDomRoot( dynamicRootElement, 'dynamicRoot' );

		const command = editor.commands.get( 'checkTodoList' );

		sinon.spy( command, 'execute' );

		_setModelData( model, '<listItem listIndent="0" listType="todo">f[]oo</listItem>', { rootName: 'dynamicRoot' } );

		let checkmarkViewElement = viewDoc.getRoot( 'dynamicRoot' ).getChild( 0 ).getChild( 0 ).getChild( 0 );
		let checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		let checkboxElement = checkmarkDomElement.children[ 0 ];

		expect( checkboxElement.checked ).to.equal( false );

		checkboxElement.dispatchEvent( new Event( 'change' ) );

		checkmarkViewElement = viewDoc.getRoot( 'dynamicRoot' ).getChild( 0 ).getChild( 0 ).getChild( 0 );
		checkmarkDomElement = view.domConverter.mapViewToDom( checkmarkViewElement );
		checkboxElement = checkmarkDomElement.children[ 0 ];

		sinon.assert.calledOnce( command.execute );
		expect( checkboxElement.checked ).to.equal( true );
		expect( _getModelData( model, { rootName: 'dynamicRoot' } ) ).to.equal(
			'<listItem listIndent="0" listType="todo" todoListChecked="true">f[]oo</listItem>'
		);

		dynamicRootElement.remove();
	} );
} );
