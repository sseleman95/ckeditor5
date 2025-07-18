/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { Autoformat } from '../src/autoformat.js';
import { blockAutoformatEditing } from '../src/blockautoformatediting.js';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph/src/paragraph.js';
import { VirtualTestEditor } from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor.js';
import { Enter } from '@ckeditor/ckeditor5-enter/src/enter.js';
import { _setModelData, _getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model.js';
import { testUtils } from '@ckeditor/ckeditor5-core/tests/_utils/utils.js';
import { Command } from '@ckeditor/ckeditor5-core/src/command.js';

describe( 'blockAutoformatEditing', () => {
	let editor, model, doc, plugin;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		return VirtualTestEditor
			.create( {
				plugins: [ Enter, Paragraph, Autoformat ]
			} )
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				doc = model.document;
				plugin = editor.plugins.get( 'Autoformat' );
			} );
	} );

	afterEach( async () => {
		await editor.destroy();
	} );

	describe( 'command name', () => {
		it( 'should run a command when the pattern is matched', () => {
			const spy = testUtils.sinon.spy();
			const testCommand = new TestCommand( editor, spy );

			editor.commands.add( 'testCommand', testCommand );

			blockAutoformatEditing( editor, plugin, /^[*]\s$/, 'testCommand' );

			_setModelData( model, '<paragraph>*[]</paragraph>' );

			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( spy );
		} );

		it( 'should remove found pattern', () => {
			const spy = testUtils.sinon.spy();
			const testCommand = new TestCommand( editor, spy );

			editor.commands.add( 'testCommand', testCommand );

			blockAutoformatEditing( editor, plugin, /^[*]\s$/, 'testCommand' );

			_setModelData( model, '<paragraph>*[]</paragraph>' );

			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( spy );
			expect( _getModelData( model ) ).to.equal( '<paragraph>[]</paragraph>' );
		} );

		it( 'should not autoformat if command is disabled', () => {
			const spy = testUtils.sinon.spy();
			const testCommand = new TestCommand( editor, spy );

			testCommand.refresh = function() {
				this.isEnabled = false;
			};

			editor.commands.add( 'testCommand', testCommand );

			blockAutoformatEditing( editor, plugin, /^[*]\s$/, 'testCommand' );

			_setModelData( model, '<paragraph>*[]</paragraph>' );

			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( spy );
		} );
	} );

	describe( 'callback', () => {
		it( 'should run callback when the pattern is matched', () => {
			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>*[]</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( spy );
		} );

		it( 'should not call the callback when the pattern is matched but the plugin is disabled', () => {
			const callbackSpy = testUtils.sinon.spy().named( 'callback' );
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, callbackSpy );

			plugin.isEnabled = false;

			_setModelData( model, '<paragraph>*[]</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( callbackSpy );
		} );

		it( 'should ignore other delta operations', () => {
			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>*[]</paragraph>' );
			model.change( writer => {
				writer.remove( doc.selection.getFirstRange() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should ignore a ranged selection', () => {
			model.schema.extend( '$text', { allowAttributes: 'foo' } );

			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>[* ]foo</paragraph>' );
			model.change( writer => {
				writer.setAttribute( 'foo', true, model.document.selection.getFirstRange() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should stop if there is no text to run matching on', () => {
			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>[]</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should not call callback when after inline element', () => {
			// Configure the schema.
			model.schema.register( 'softBreak', {
				allowWhere: '$text',
				isInline: true
			} );
			editor.conversion.for( 'upcast' )
				.elementToElement( {
					model: 'softBreak',
					view: 'br'
				} );
			editor.conversion.for( 'downcast' )
				.elementToElement( {
					model: 'softBreak',
					view: ( modelElement, { writer } ) => writer.createEmptyElement( 'br' )
				} );

			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>*<softBreak></softBreak>[]</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should not call callback when typing in the middle of block text', () => {
			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>* foo[]bar</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should not call callback when after inline element (typing after softBreak in a "matching" paragraph)', () => {
			// Configure the schema.
			model.schema.register( 'softBreak', {
				allowWhere: '$text',
				isInline: true
			} );
			editor.conversion.for( 'upcast' )
				.elementToElement( {
					model: 'softBreak',
					view: 'br'
				} );
			editor.conversion.for( 'downcast' )
				.elementToElement( {
					model: 'softBreak',
					view: ( modelElement, { writer } ) => writer.createEmptyElement( 'br' )
				} );

			const spy = testUtils.sinon.spy();
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

			_setModelData( model, '<paragraph>* <softBreak></softBreak>[]</paragraph>' );

			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( spy );
		} );

		it( 'should stop if callback returned false', () => {
			blockAutoformatEditing( editor, plugin, /^[*]\s$/, () => false );

			_setModelData( model, '<paragraph>*[]</paragraph>' );
			model.change( writer => {
				writer.insertText( ' ', doc.selection.getFirstPosition() );
			} );

			expect( _getModelData( model ) ).to.equal( '<paragraph>* []</paragraph>' );
		} );
	} );

	it( 'should ignore non-local batches', () => {
		const spy = testUtils.sinon.spy();
		blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

		_setModelData( model, '<paragraph>*[]</paragraph>' );
		model.enqueueChange( { isLocal: false }, writer => {
			writer.insertText( ' ', doc.selection.getFirstPosition() );
		} );

		sinon.assert.notCalled( spy );
	} );

	it( 'should ignore undo batches', () => {
		const spy = testUtils.sinon.spy();
		blockAutoformatEditing( editor, plugin, /^[*]\s$/, spy );

		_setModelData( model, '<paragraph>*[]</paragraph>' );
		model.enqueueChange( { isUndo: true }, writer => {
			writer.insertText( ' ', doc.selection.getFirstPosition() );
		} );

		sinon.assert.notCalled( spy );
	} );
} );

/**
 * Dummy command to execute.
 */
class TestCommand extends Command {
	/**
	 * Creates an instance of the command.
	 *
	 * @param {module:core/editor/editor~Editor} editor Editor instance.
	 * @param {Function} onExecuteCallback execute call hook
	 */
	constructor( editor, onExecuteCallback ) {
		super( editor );

		this.onExecute = onExecuteCallback;
	}

	/**
	 * Executes command.
	 *
	 * @protected
	 */
	execute() {
		this.onExecute();
	}
}
