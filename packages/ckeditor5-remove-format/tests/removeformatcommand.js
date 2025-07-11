/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { RemoveFormatCommand } from '../src/removeformatcommand.js';
import { Command } from '@ckeditor/ckeditor5-core/src/command.js';
import { ModelTestEditor } from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor.js';
import {
	_getModelData,
	_setModelData
} from '@ckeditor/ckeditor5-engine/src/dev-utils/model.js';

describe( 'RemoveFormatCommand', () => {
	let editor, model, command;

	beforeEach( () => {
		return ModelTestEditor.create()
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;

				command = new RemoveFormatCommand( newEditor );
				editor.commands.add( 'removeFormat', command );

				model.schema.register( 'p', {
					inheritAllFrom: '$block',
					allowAttributes: 'someBlockFormatting'
				} );

				model.schema.addAttributeCheck( ( ctx, attributeName ) => {
					// Bold will be used as an example formatting attribute.
					if ( ctx.endsWith( 'p $text' ) && attributeName == 'bold' ) {
						return true;
					}
				} );

				model.schema.addAttributeCheck( ( ctx, attributeName ) => {
					// Text attribtue "irrelevant" will be used to make sure that non-formatting
					// is note being removed.
					if ( ctx.endsWith( 'p $text' ) && attributeName == 'irrelevant' ) {
						return true;
					}
				} );

				model.schema.setAttributeProperties( 'bold', {
					isFormatting: true
				} );

				model.schema.setAttributeProperties( 'someBlockFormatting', {
					isFormatting: true
				} );

				// Custom attribute handling.
				model.schema.extend( 'p', { allowAttributes: [ 'fooA', 'fooB' ] } );

				command.registerCustomAttribute(
					attributeName => attributeName.startsWith( 'foo' ),
					( attributeName, itemRange, writer ) => {
						for ( const item of itemRange.getItems( { shallow: true } ) ) {
							const value = item.getAttribute( attributeName );

							if ( value ) {
								writer.setAttribute( attributeName, value.toUpperCase(), item );
							}
						}
					}
				);
			} );
	} );

	afterEach( async () => {
		await editor.destroy();
	} );

	it( 'is a command', () => {
		expect( RemoveFormatCommand.prototype ).to.be.instanceOf( Command );
		expect( command ).to.be.instanceOf( Command );
	} );

	describe( 'isEnabled', () => {
		const expectEnabledPropertyToBe = expectedValue => expect( command ).to.have.property( 'isEnabled', expectedValue );
		const cases = {
			'state when in non-formatting markup': {
				input: '<p>fo[]o</p>',
				assert: () => expectEnabledPropertyToBe( false )
			},

			'state with collapsed selection in formatting markup': {
				input: '<p>f<$text bold="true">o[]o</$text></p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with selection containing formatting in the middle': {
				input: '<p>f[oo <$text bold="true">bar</$text> ba]z</p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with partially selected formatting at the start': {
				input: '<p><$text bold="true">b[ar</$text> ba]z</p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with partially selected formatting at the end': {
				input: '<p>f[oo <$text bold="true">ba]z</$text></p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with formatted selection alone': {
				input: '<p>fo[]o</p>',
				setDataOptions: {
					selectionAttributes: {
						bold: true,
						irrelevant: true
					}
				},
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with block formatting': {
				input: '<p someBlockFormatting="foo">f[oo</p><p>]bar</p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with block formatting (collapsed selection)': {
				input: '<p someBlockFormatting="foo">f[]oo</p>',
				assert: () => expectEnabledPropertyToBe( true )
			},

			'state with custom block formatting': {
				input: '<p fooA="bar">f[oo</p><p fooB="baz">b]ar</p>',
				assert: () => expectEnabledPropertyToBe( true )
			}
		};

		generateTypicalUseCases( cases );
	} );

	describe( 'execute()', () => {
		const expectModelToBeEqual = expectedValue => expect( _getModelData( model ) ).to.equal( expectedValue );
		const cases = {
			'state when in non-formatting markup': {
				input: '<p>fo[]o</p>',
				assert: () => expectModelToBeEqual( '<p>fo[]o</p>' )
			},

			'state with collapsed selection in formatting markup': {
				input: '<p>f<$text bold="true">o[]o</$text></p>',
				assert: () => expectModelToBeEqual( '<p>f<$text bold="true">o</$text>[]<$text bold="true">o</$text></p>' )
			},

			'state with selection containing formatting in the middle': {
				input: '<p>f[oo <$text bold="true">bar</$text> ba]z</p>',
				assert: () => expectModelToBeEqual( '<p>f[oo bar ba]z</p>' )
			},

			'state with partially selected formatting at the start': {
				input: '<p><$text bold="true">b[ar</$text> ba]z</p>',
				assert: () => expectModelToBeEqual( '<p><$text bold="true">b</$text>[ar ba]z</p>' )
			},

			'state with partially selected formatting at the end': {
				input: '<p>f[oo <$text bold="true">ba]z</$text></p>',
				assert: () => expectModelToBeEqual( '<p>f[oo ba]<$text bold="true">z</$text></p>' )
			},

			'state with formatted selection alone': {
				input: '<p>fo[]o</p>',
				setDataOptions: {
					selectionAttributes: {
						bold: true,
						irrelevant: true
					}
				},
				assert: () => {
					expect( model.document.selection.hasAttribute( 'bold' ) ).to.equal( false );
					expect( model.document.selection.hasAttribute( 'irrelevant' ) ).to.equal( true );
				}
			},

			'state with block formatting': {
				input: '<p someBlockFormatting="foo">f[oo</p><p someBlockFormatting="bar">]bar</p>',
				assert: () => expectModelToBeEqual( '<p>f[oo</p><p someBlockFormatting="bar">]bar</p>' )
			},

			'state with block formatting (collapsed selection)': {
				input: '<p someBlockFormatting="foo">f[]oo</p><p someBlockFormatting="bar">bar</p>',
				assert: () => expectModelToBeEqual( '<p>f[]oo</p><p someBlockFormatting="bar">bar</p>' )
			},

			'state with custom block formatting': {
				input: '<p fooA="bar">f[oo</p><p fooB="baz">b]ar</p>',
				assert: () => expectModelToBeEqual( '<p fooA="BAR">f[oo</p><p fooB="BAZ">b]ar</p>' )
			}
		};

		generateTypicalUseCases( cases, {
			beforeAssert: () => command.execute()
		} );
	} );

	function generateTypicalUseCases( useCases, options ) {
		for ( const [ key, testConfig ] of Object.entries( useCases ) ) {
			it( key, () => {
				_setModelData( model, testConfig.input, testConfig.setDataOptions );

				if ( options && options.beforeAssert ) {
					options.beforeAssert();
				}

				testConfig.assert();
			} );
		}
	}
} );
