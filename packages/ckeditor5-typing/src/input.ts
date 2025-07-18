/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/**
 * @module typing/input
 */

import { Plugin, type Editor } from '@ckeditor/ckeditor5-core';
import { env } from '@ckeditor/ckeditor5-utils';

import { InsertTextCommand, type InsertTextCommandOptions } from './inserttextcommand.js';
import { InsertTextObserver, type ViewDocumentInsertTextEvent } from './inserttextobserver.js';

import {
	ModelLiveRange,
	_tryFixingModelRange,
	type Model,
	type Mapper,
	type ModelElement,
	type ModelRange,
	type ViewNode,
	type ViewElement,
	type ObserverMutationData,
	type ViewDocumentCompositionStartEvent,
	type ViewDocumentCompositionEndEvent,
	type ViewDocumentKeyDownEvent,
	type ViewDocumentMutationsEvent,
	type ViewDocumentInputEvent
} from '@ckeditor/ckeditor5-engine';

import { debounce } from 'es-toolkit/compat';

// @if CK_DEBUG_TYPING // const { _debouncedLine, _buildLogMessage } = require( '@ckeditor/ckeditor5-engine/src/dev-utils/utils.js' );

/**
 * Handles text input coming from the keyboard or other input methods.
 */
export class Input extends Plugin {
	/**
	 * The queue of `insertText` command executions that are waiting for the DOM to get updated after beforeinput event.
	 */
	private _typingQueue!: TypingQueue;

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'Input' as const;
	}

	/**
	 * @inheritDoc
	 */
	public static override get isOfficialPlugin(): true {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public init(): void {
		const editor = this.editor;
		const model = editor.model;
		const view = editor.editing.view;
		const mapper = editor.editing.mapper;
		const modelSelection = model.document.selection;

		this._typingQueue = new TypingQueue( editor );

		view.addObserver( InsertTextObserver );

		// TODO The above default configuration value should be defined using editor.config.define() once it's fixed.
		const insertTextCommand = new InsertTextCommand( editor, editor.config.get( 'typing.undoStep' ) || 20 );

		// Register `insertText` command and add `input` command as an alias for backward compatibility.
		editor.commands.add( 'insertText', insertTextCommand );
		editor.commands.add( 'input', insertTextCommand );

		this.listenTo<ViewDocumentInputEvent>( view.document, 'beforeinput', () => {
			// Flush queue on the next beforeinput event because it could happen
			// that the mutation observer does not notice the DOM change in time.
			this._typingQueue.flush( 'next beforeinput' );
		}, { priority: 'high' } );

		this.listenTo<ViewDocumentInsertTextEvent>( view.document, 'insertText', ( evt, data ) => {
			const { text, selection: viewSelection } = data;

			// In case of a synthetic event, make sure that selection is not fake.
			if ( view.document.selection.isFake && viewSelection && view.document.selection.isSimilar( viewSelection ) ) {
				data.preventDefault();
			}

			// In case of typing on a non-collapsed range, we have to handle it ourselves as a browser
			// could modify the DOM unpredictably.
			// Noticed cases:
			// * <pre><code>[foo</code></pre><p>]bar</p>
			// * <p>[foo</p><pre>]<code>bar</code></pre>
			// * <p>[foo</p><blockquote><p>]bar</p></blockquote>
			//
			// Especially tricky case is when a code block follows a paragraph as code block on the view side
			// is rendered as a <code> element inside a <pre> element, but only the <code> element is mapped to the model.
			// While mapping view position <pre>]<code> to model, the model position results before the <codeBlock> element,
			// and this triggers selection fixer to cover only text in the previous paragraph.
			//
			// This is safe for composition as those events are not cancellable
			// and the preventDefault() and defaultPrevented are not affected.
			if ( viewSelection && Array.from( viewSelection.getRanges() ).some( range => !range.isCollapsed ) ) {
				data.preventDefault();
			}

			if ( !insertTextCommand.isEnabled ) {
				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		'%cInsertText command is disabled - prevent DOM change.',
				// @if CK_DEBUG_TYPING // 		'font-style: italic'
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }

				data.preventDefault();

				return;
			}

			let modelRanges;

			// If view selection was specified, translate it to model selection.
			if ( viewSelection ) {
				modelRanges = Array.from( viewSelection.getRanges() )
					.map( viewRange => mapper.toModelRange( viewRange ) )
					.map( modelRange => _tryFixingModelRange( modelRange, model.schema ) || modelRange );
			}
			else {
				modelRanges = Array.from( modelSelection.getRanges() );
			}

			let insertText = text;

			// Typing in English on Android is firing composition events for the whole typed word.
			// We need to check the target range text to only apply the difference.
			if ( env.isAndroid ) {
				const selectedText = Array.from( modelRanges[ 0 ].getItems() ).reduce( ( rangeText, node ) => {
					return rangeText + ( node.is( '$textProxy' ) ? node.data : '' );
				}, '' );

				if ( selectedText ) {
					if ( selectedText.length <= insertText.length ) {
						if ( insertText.startsWith( selectedText ) ) {
							insertText = insertText.substring( selectedText.length );
							( modelRanges[ 0 ] as any ).start = modelRanges[ 0 ].start.getShiftedBy( selectedText.length );
						}
					} else {
						if ( selectedText.startsWith( insertText ) ) {
							// TODO this should be mapped as delete?
							( modelRanges[ 0 ] as any ).start = modelRanges[ 0 ].start.getShiftedBy( insertText.length );
							insertText = '';
						}
					}
				}

				if ( insertText.length == 0 && modelRanges[ 0 ].isCollapsed ) {
					// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
					// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
					// @if CK_DEBUG_TYPING // 		'%cIgnore insertion of an empty data to the collapsed range.',
					// @if CK_DEBUG_TYPING // 		'font-style: italic'
					// @if CK_DEBUG_TYPING // 	) );
					// @if CK_DEBUG_TYPING // }

					return;
				}
			}

			// Note: the TypingQueue stores live-ranges internally as RTC could change the model while waiting for mutations.
			const commandData: InsertTextCommandOptions = {
				text: insertText,
				selection: model.createSelection( modelRanges )
			};

			// This is a beforeinput event, so we need to wait until the browser updates the DOM,
			// and we could apply changes to the model and verify if the DOM is valid.
			// The browser applies changes to the DOM not immediately on beforeinput event.
			// We just wait for mutation observer to notice changes or as a fallback a timeout.
			//
			// Previously we were cancelling the non-composition events, but it caused issues especially in Safari.

			// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
			// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
			// @if CK_DEBUG_TYPING // 		`%cQueue insertText:%c "${ commandData.text }"%c ` +
			// @if CK_DEBUG_TYPING // 		`[${ commandData.selection.getFirstPosition().path }]-` +
			// @if CK_DEBUG_TYPING // 		`[${ commandData.selection.getLastPosition().path }]` +
			// @if CK_DEBUG_TYPING // 		` queue size: ${ this._typingQueue.length + 1 }`,
			// @if CK_DEBUG_TYPING // 		'font-weight: bold',
			// @if CK_DEBUG_TYPING // 		'color: blue',
			// @if CK_DEBUG_TYPING // 		''
			// @if CK_DEBUG_TYPING // 	) );
			// @if CK_DEBUG_TYPING // }

			this._typingQueue.push( commandData, Boolean( data.isComposing ) );

			if ( data.domEvent.defaultPrevented ) {
				this._typingQueue.flush( 'beforeinput default prevented' );
			}
		} );

		// Delete selected content on composition start.
		if ( env.isAndroid ) {
			// On Android with English keyboard, the composition starts just by putting caret
			// at the word end or by selecting a table column. This is not a real composition started.
			// Trigger delete content on first composition key pressed.
			this.listenTo<ViewDocumentKeyDownEvent>( view.document, 'keydown', ( evt, data ) => {
				if ( modelSelection.isCollapsed || data.keyCode != 229 || !view.document.isComposing ) {
					return;
				}

				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	const firstPositionPath = modelSelection.getFirstPosition()!.path;
				// @if CK_DEBUG_TYPING // 	const lastPositionPath = modelSelection.getLastPosition()!.path;

				// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		'%cKeyDown 229%c -> model.deleteContent() ' +
				// @if CK_DEBUG_TYPING // 		`[${ firstPositionPath }]-[${ lastPositionPath }]`,
				// @if CK_DEBUG_TYPING // 		'font-weight: bold',
				// @if CK_DEBUG_TYPING // 		''
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }

				deleteSelectionContent( model, insertTextCommand );
			} );
		} else {
			// Note: The priority must precede the CompositionObserver handler to call it before
			// the renderer is blocked, because we want to render this change.
			this.listenTo<ViewDocumentCompositionStartEvent>( view.document, 'compositionstart', () => {
				if ( modelSelection.isCollapsed ) {
					return;
				}

				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	const firstPositionPath = modelSelection.getFirstPosition()!.path;
				// @if CK_DEBUG_TYPING // 	const lastPositionPath = modelSelection.getLastPosition()!.path;

				// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		'%cComposition start%c -> model.deleteContent() ' +
				// @if CK_DEBUG_TYPING // 		`[${ firstPositionPath }]-[${ lastPositionPath }]`,
				// @if CK_DEBUG_TYPING // 		'font-weight: bold',
				// @if CK_DEBUG_TYPING // 		'',
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }

				deleteSelectionContent( model, insertTextCommand );
			}, { priority: 'high' } );
		}

		// Apply changes to the model as they are applied to the DOM by the browser.
		// On beforeinput event, the DOM is not yet modified. We wait for detected mutations to apply model changes.
		this.listenTo<ViewDocumentMutationsEvent>( view.document, 'mutations', ( evt, { mutations } ) => {
			// Check if mutations are relevant for queued changes.
			if ( this._typingQueue.hasAffectedElements() ) {
				for ( const { node } of mutations ) {
					const viewElement = findMappedViewAncestor( node, mapper );
					const modelElement = mapper.toModelElement( viewElement )!;

					if ( this._typingQueue.isElementAffected( modelElement ) ) {
						this._typingQueue.flush( 'mutations' );

						return;
					}
				}
			}

			// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
			// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
			// @if CK_DEBUG_TYPING // 		'%cMutations not related to the composition.',
			// @if CK_DEBUG_TYPING // 		'font-style: italic'
			// @if CK_DEBUG_TYPING // 	) );
			// @if CK_DEBUG_TYPING // }
		} );

		// Make sure that all changes are applied to the model before the end of composition.
		this.listenTo<ViewDocumentCompositionEndEvent>( view.document, 'compositionend', () => {
			this._typingQueue.flush( 'before composition end' );
		}, { priority: 'high' } );

		// Trigger mutations check after the composition completes to fix all DOM changes that got ignored during composition.
		// On Android, the Renderer is not disabled while composing. While updating DOM nodes, we ignore some changes
		// that are not that important (like NBSP vs. plain space character) and could break the composition flow.
		// After composition is completed, we trigger additional `mutations` event for elements affected by the composition
		// so the Renderer can adjust the DOM to the expected structure without breaking the composition.
		this.listenTo<ViewDocumentCompositionEndEvent>( view.document, 'compositionend', () => {
			// There could be new item queued on the composition end, so flush it.
			this._typingQueue.flush( 'after composition end' );

			const mutations: Array<ObserverMutationData> = [];

			if ( this._typingQueue.hasAffectedElements() ) {
				for ( const element of this._typingQueue.flushAffectedElements() ) {
					const viewElement = mapper.toViewElement( element );

					if ( !viewElement ) {
						continue;
					}

					mutations.push( { type: 'children', node: viewElement } );
				}
			}

			// Fire composition mutations, if any.
			//
			// For non-Android:
			// After the composition end, we need to verify if there are no left-overs.
			// Listening at the lowest priority, so after the `InsertTextObserver` added above (all composed text
			// should already be applied to the model, view, and DOM).
			// On non-Android the `Renderer` is blocked while the user is composing, but the `MutationObserver` still collects
			// mutated nodes and fires `mutations` events.
			// Those events are recorded by the `Renderer` but not applied to the DOM while composing.
			// We need to trigger those checks (and fixes) once again but this time without specifying the exact mutations
			// since they are already recorded by the `Renderer`.
			// It in most cases just clears the internal record of mutated text nodes
			// since all changes should already be applied to the DOM.
			// This is especially needed when a user cancels composition, so we can clear nodes marked to sync.
			if ( mutations.length || !env.isAndroid ) {
				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	console.group( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		'%cFire post-composition mutation fixes.',
				// @if CK_DEBUG_TYPING // 		'font-weight: bold'
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }

				view.document.fire<ViewDocumentMutationsEvent>( 'mutations', { mutations } );

				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	console.groupEnd();
				// @if CK_DEBUG_TYPING // }
			}
		}, { priority: 'lowest' } );
	}

	/**
	 * @inheritDoc
	 */
	public override destroy(): void {
		super.destroy();

		this._typingQueue.destroy();
	}
}

/**
 * The queue of `insertText` command executions that are waiting for the DOM to get updated after beforeinput event.
 */
class TypingQueue {
	/**
	 * The editor instance.
	 */
	public editor: Editor;

	/**
	 * Debounced queue flush as a safety mechanism for cases of mutation observer not triggering.
	 */
	public flushDebounced = debounce( () => this.flush( 'timeout' ), 50 );

	/**
	 * The queue of `insertText` command executions that are waiting for the DOM to get updated after beforeinput event.
	 */
	private _queue: Array<InsertTextCommandLiveOptions> = [];

	/**
	 * Whether there is any composition enqueued or plain typing only.
	 */
	private _isComposing = false;

	/**
	 * A set of model elements. The typing happened in those elements. It's used for mutations check.
	 */
	private _affectedElements = new Set<ModelElement>();

	/**
	 * @inheritDoc
	 */
	constructor( editor: Editor ) {
		this.editor = editor;
	}

	/**
	 * Destroys the helper object.
	 */
	public destroy(): void {
		this.flushDebounced.cancel();
		this._affectedElements.clear();

		while ( this._queue.length ) {
			this.shift();
		}
	}

	/**
	 * Returns the size of the queue.
	 */
	public get length(): number {
		return this._queue.length;
	}

	/**
	 * Push next insertText command data to the queue.
	 */
	public push( commandData: InsertTextCommandOptions, isComposing: boolean ): void {
		const commandLiveData: InsertTextCommandLiveOptions = {
			text: commandData.text
		};

		if ( commandData.selection ) {
			commandLiveData.selectionRanges = [];

			for ( const range of commandData.selection.getRanges() ) {
				commandLiveData.selectionRanges.push( ModelLiveRange.fromRange( range ) );

				// Keep reference to the model element for later mutation checks.
				this._affectedElements.add( range.start.parent as ModelElement );
			}
		}

		this._queue.push( commandLiveData );
		this._isComposing ||= isComposing;
		this.flushDebounced();
	}

	/**
	 * Shift the first item from the insertText command data queue.
	 */
	public shift(): InsertTextCommandOptions {
		const commandLiveData = this._queue.shift()!;
		const commandData: InsertTextCommandOptions = {
			text: commandLiveData.text
		};

		if ( commandLiveData.selectionRanges ) {
			const ranges = commandLiveData.selectionRanges
				.map( liveRange => detachLiveRange( liveRange ) )
				.filter( ( range ): range is ModelRange => !!range );

			if ( ranges.length ) {
				commandData.selection = this.editor.model.createSelection( ranges );
			}
		}

		return commandData;
	}

	/**
	 * Applies all queued insertText command executions.
	 *
	 * @param reason Used only for debugging.
	 */
	public flush( reason: string ): void { // eslint-disable-line @typescript-eslint/no-unused-vars
		const editor = this.editor;
		const model = editor.model;
		const view = editor.editing.view;

		this.flushDebounced.cancel();

		if ( !this._queue.length ) {
			return;
		}

		// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
		// @if CK_DEBUG_TYPING // 	console.group( ..._buildLogMessage( this, 'Input',
		// @if CK_DEBUG_TYPING // 		`%cFlush insertText queue on ${ reason }.`,
		// @if CK_DEBUG_TYPING // 		'font-weight: bold'
		// @if CK_DEBUG_TYPING // 	) );
		// @if CK_DEBUG_TYPING // }

		const insertTextCommand = editor.commands.get( 'insertText' )!;
		const buffer = insertTextCommand.buffer;

		model.enqueueChange( buffer.batch, () => {
			buffer.lock();

			while ( this._queue.length ) {
				const commandData = this.shift();

				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		`%cExecute queued insertText:%c "${ commandData.text }"%c ` +
				// @if CK_DEBUG_TYPING // 			`[${ commandData.selection.getFirstPosition().path }]-` +
				// @if CK_DEBUG_TYPING // 			`[${ commandData.selection.getLastPosition().path }]`,
				// @if CK_DEBUG_TYPING // 		'font-weight: bold',
				// @if CK_DEBUG_TYPING // 		'color: blue',
				// @if CK_DEBUG_TYPING // 		''
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }

				editor.execute( 'insertText', commandData );
			}

			buffer.unlock();

			if ( !this._isComposing ) {
				// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
				// @if CK_DEBUG_TYPING // 	console.log( ..._buildLogMessage( this, 'Input',
				// @if CK_DEBUG_TYPING // 		'Clear affected elements set'
				// @if CK_DEBUG_TYPING // 	) );
				// @if CK_DEBUG_TYPING // }
				this._affectedElements.clear();
			}

			this._isComposing = false;
		} );

		view.scrollToTheSelection();

		// @if CK_DEBUG_TYPING // if ( ( window as any ).logCKETyping ) {
		// @if CK_DEBUG_TYPING // 	console.groupEnd();
		// @if CK_DEBUG_TYPING // }
	}

	/**
	 * Returns `true` if the given model element is related to recent typing.
	 */
	public isElementAffected( element: ModelElement ): boolean {
		return this._affectedElements.has( element );
	}

	/**
	 * Returns `true` if there are any affected elements in the queue.
	 */
	public hasAffectedElements(): boolean {
		return this._affectedElements.size > 0;
	}

	/**
	 * Returns an array of typing-related elements and clears the internal list.
	 */
	public flushAffectedElements(): Array<ModelElement> {
		const result = Array.from( this._affectedElements );

		this._affectedElements.clear();

		return result;
	}
}

/**
 * Deletes the content selected by the document selection at the start of composition.
 */
function deleteSelectionContent( model: Model, insertTextCommand: InsertTextCommand ): void {
	// By relying on the state of the input command we allow disabling the entire input easily
	// by just disabling the input command. We could’ve used here the delete command but that
	// would mean requiring the delete feature which would block loading one without the other.
	// We could also check the editor.isReadOnly property, but that wouldn't allow to block
	// the input without blocking other features.
	if ( !insertTextCommand.isEnabled ) {
		return;
	}

	const buffer = insertTextCommand.buffer;

	buffer.lock();

	model.enqueueChange( buffer.batch, () => {
		model.deleteContent( model.document.selection );
	} );

	buffer.unlock();
}

/**
 * Detaches a ModelLiveRange and returns the static range from it.
 */
function detachLiveRange( liveRange: ModelLiveRange ): ModelRange | null {
	const range = liveRange.toRange();

	liveRange.detach();

	if ( range.root.rootName == '$graveyard' ) {
		return null;
	}

	return range;
}

/**
 * For the given `viewNode`, finds and returns the closest ancestor of this node that has a mapping to the model.
 */
function findMappedViewAncestor( viewNode: ViewNode, mapper: Mapper ): ViewElement {
	let node = ( viewNode.is( '$text' ) ? viewNode.parent : viewNode ) as ViewElement;

	while ( !mapper.toModelElement( node ) ) {
		node = node.parent as ViewElement;
	}

	return node;
}

/**
 * The insertText command data stored as ModelLiveRange-s.
 */
type InsertTextCommandLiveOptions = {
	text?: string;
	selectionRanges?: Array<ModelLiveRange>;
};
