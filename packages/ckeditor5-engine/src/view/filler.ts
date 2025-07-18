/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

import { keyCodes, isText, type KeystrokeInfo } from '@ckeditor/ckeditor5-utils';
import { type EditingView } from './view.js';
import { type ViewDocumentDomEventData } from './observer/domeventdata.js';
import type { ViewDocumentArrowKeyEvent } from './observer/arrowkeysobserver.js';

/**
 * Set of utilities related to handling block and inline fillers.
 *
 * Browsers do not allow to put caret in elements which does not have height. Because of it, we need to fill all
 * empty elements which should be selectable with elements or characters called "fillers". Unfortunately there is no one
 * universal filler, this is why two types are uses:
 *
 * * Block filler is an element which fill block elements, like `<p>`. CKEditor uses `<br>` as a block filler during the editing,
 * as browsers do natively. So instead of an empty `<p>` there will be `<p><br></p>`. The advantage of block filler is that
 * it is transparent for the selection, so when the caret is before the `<br>` and user presses right arrow he will be
 * moved to the next paragraph, not after the `<br>`. The disadvantage is that it breaks a block, so it cannot be used
 * in the middle of a line of text. The {@link module:engine/view/filler~BR_FILLER `<br>` filler} can be replaced with any other
 * character in the data output, for instance {@link module:engine/view/filler~NBSP_FILLER non-breaking space} or
 * {@link module:engine/view/filler~MARKED_NBSP_FILLER marked non-breaking space}.
 *
 * * Inline filler is a filler which does not break a line of text, so it can be used inside the text, for instance in the empty
 * `<b>` surrendered by text: `foo<b></b>bar`, if we want to put the caret there. CKEditor uses a sequence of the zero-width
 * spaces as an {@link module:engine/view/filler~INLINE_FILLER inline filler} having the predetermined
 * {@link module:engine/view/filler~INLINE_FILLER_LENGTH length}. A sequence is used, instead of a single character to
 * avoid treating random zero-width spaces as the inline filler. Disadvantage of the inline filler is that it is not
 * transparent for the selection. The arrow key moves the caret between zero-width spaces characters, so the additional
 * code is needed to handle the caret.
 *
 * Both inline and block fillers are handled by the {@link module:engine/view/renderer~ViewRenderer renderer} and are not present in the
 * view.
 *
 * @module engine/view/filler
 */

/**
 * Non-breaking space filler creator. This function creates the `&nbsp;` text node.
 * It defines how the filler is created.
 *
 * @see module:engine/view/filler~MARKED_NBSP_FILLER
 * @see module:engine/view/filler~BR_FILLER
 * @internal
 */
export const NBSP_FILLER = ( domDocument: Document ): Text => domDocument.createTextNode( '\u00A0' );

/**
 * Marked non-breaking space filler creator. This function creates the `<span data-cke-filler="true">&nbsp;</span>` element.
 * It defines how the filler is created.
 *
 * @see module:engine/view/filler~NBSP_FILLER
 * @see module:engine/view/filler~BR_FILLER
 * @internal
 */
export const MARKED_NBSP_FILLER = ( domDocument: Document ): HTMLSpanElement => {
	const span = domDocument.createElement( 'span' );
	span.dataset.ckeFiller = 'true';
	span.innerText = '\u00A0';

	return span;
};

/**
 * `<br>` filler creator. This function creates the `<br data-cke-filler="true">` element.
 * It defines how the filler is created.
 *
 * @see module:engine/view/filler~NBSP_FILLER
 * @see module:engine/view/filler~MARKED_NBSP_FILLER
 * @internal
 */
export const BR_FILLER = ( domDocument: Document ): HTMLBRElement => {
	const fillerBr = domDocument.createElement( 'br' );
	fillerBr.dataset.ckeFiller = 'true';

	return fillerBr;
};

/**
 * Length of the {@link module:engine/view/filler~INLINE_FILLER INLINE_FILLER}.
 *
 * @internal
 */
export const INLINE_FILLER_LENGTH = 7;

/**
 * Inline filler which is a sequence of the word joiners.
 *
 * @internal
 */
export const INLINE_FILLER = '\u2060'.repeat( INLINE_FILLER_LENGTH );

/**
 * Checks if the node is a text node which starts with the {@link module:engine/view/filler~INLINE_FILLER inline filler}.
 *
 * ```ts
 * startsWithFiller( document.createTextNode( INLINE_FILLER ) ); // true
 * startsWithFiller( document.createTextNode( INLINE_FILLER + 'foo' ) ); // true
 * startsWithFiller( document.createTextNode( 'foo' ) ); // false
 * startsWithFiller( document.createElement( 'p' ) ); // false
 * ```
 *
 * @param domNode DOM node.
 * @returns True if the text node starts with the {@link module:engine/view/filler~INLINE_FILLER inline filler}.
 * @internal
 */
export function startsWithFiller( domNode: Node | string ): boolean {
	if ( typeof domNode == 'string' ) {
		return domNode.substr( 0, INLINE_FILLER_LENGTH ) === INLINE_FILLER;
	}

	return isText( domNode ) && ( domNode.data.substr( 0, INLINE_FILLER_LENGTH ) === INLINE_FILLER );
}

/**
 * Checks if the text node contains only the {@link module:engine/view/filler~INLINE_FILLER inline filler}.
 *
 * ```ts
 * isInlineFiller( document.createTextNode( INLINE_FILLER ) ); // true
 * isInlineFiller( document.createTextNode( INLINE_FILLER + 'foo' ) ); // false
 * ```
 *
 * @param domText DOM text node.
 * @returns True if the text node contains only the {@link module:engine/view/filler~INLINE_FILLER inline filler}.
 * @internal
 */
export function isInlineFiller( domText: Text ): boolean {
	return domText.data.length == INLINE_FILLER_LENGTH && startsWithFiller( domText );
}

/**
 * Get string data from the text node, removing an {@link module:engine/view/filler~INLINE_FILLER inline filler} from it,
 * if text node contains it.
 *
 * ```ts
 * getDataWithoutFiller( document.createTextNode( INLINE_FILLER + 'foo' ) ) == 'foo' // true
 * getDataWithoutFiller( document.createTextNode( 'foo' ) ) == 'foo' // true
 * ```
 *
 * @param domText DOM text node, possible with inline filler.
 * @returns Data without filler.
 * @internal
 */
export function getDataWithoutFiller( domText: Text | string ): string {
	const data = typeof domText == 'string' ? domText : domText.data;

	if ( startsWithFiller( domText ) ) {
		return data.slice( INLINE_FILLER_LENGTH );
	}

	return data;
}

/**
 * Assign key observer which move cursor from the end of the inline filler to the beginning of it when
 * the left arrow is pressed, so the filler does not break navigation.
 *
 * @param view View controller instance we should inject quirks handling on.
 * @internal
 */
export function injectQuirksHandling( view: EditingView ): void {
	view.document.on<ViewDocumentArrowKeyEvent>( 'arrowKey', jumpOverInlineFiller, { priority: 'low' } );
}

/**
 * Move cursor from the end of the inline filler to the beginning of it when, so the filler does not break navigation.
 */
function jumpOverInlineFiller( evt: unknown, data: ViewDocumentDomEventData & KeystrokeInfo ) {
	if ( data.keyCode == keyCodes.arrowleft ) {
		const domSelection = data.domTarget.ownerDocument.defaultView!.getSelection()!;

		if ( domSelection.rangeCount == 1 && domSelection.getRangeAt( 0 ).collapsed ) {
			const domParent = domSelection.getRangeAt( 0 ).startContainer;
			const domOffset = domSelection.getRangeAt( 0 ).startOffset;

			if ( startsWithFiller( domParent ) && domOffset <= INLINE_FILLER_LENGTH ) {
				domSelection.collapse( domParent, 0 );
			}
		}
	}
}
