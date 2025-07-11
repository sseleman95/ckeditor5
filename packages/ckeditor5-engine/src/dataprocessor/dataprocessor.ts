/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/**
 * @module engine/dataprocessor/dataprocessor
 */

import { type ViewDocumentFragment } from '../view/documentfragment.js';
import type { MatcherPattern } from '../view/matcher.js';

/**
 * The data processor interface. It should be implemented by actual data processors.
 *
 * Each data processor implements a certain format of the data. For example, {@glink features/markdown Markdown data processor}
 * will convert the data (a Markdown string) to a {@link module:engine/view/documentfragment~ViewDocumentFragment document fragment}
 * and back.
 *
 * **Note:** While the CKEditor 5 architecture supports changing the data format, in most scenarios we do recommend sticking to
 * the default format which is HTML (supported by the {@link module:engine/dataprocessor/htmldataprocessor~HtmlDataProcessor}).
 * HTML remains [the best standard for rich-text data](https://medium.com/content-uneditable/a-standard-for-rich-text-data-4b3a507af552).
 *
 * And please do remember – using Markdown [does not automatically make your
 * application/website secure](https://github.com/ckeditor/ckeditor5-markdown-gfm/issues/16#issuecomment-375752994).
 */
export interface DataProcessor {

	/**
	 * Converts a {@link module:engine/view/documentfragment~ViewDocumentFragment document fragment} to data.
	 *
	 * @param viewFragment The document fragment to be processed.
	 */
	toData( viewFragment: ViewDocumentFragment ): string;

	/**
	 * Converts the data to a {@link module:engine/view/documentfragment~ViewDocumentFragment document fragment}.
	 *
	 * @param data The data to be processed.
	 */
	toView( data: string ): ViewDocumentFragment;

	/**
	 * Registers a {@link module:engine/view/matcher~MatcherPattern} for view elements whose content should be treated as raw data
	 * and its content should be converted to a
	 * {@link module:engine/view/element~ViewElement#getCustomProperty custom property of a view element} called `"$rawContent"` while
	 * converting {@link #toView to view}.
	 *
	 * @param pattern Pattern matching all view elements whose content should be treated as plain text.
	 */
	registerRawContentMatcher( pattern: MatcherPattern ): void;

	/**
	 * If the processor is set to use marked fillers, it will insert `&nbsp;` fillers wrapped in `<span>` elements
	 * (`<span data-cke-filler="true">&nbsp;</span>`) instead of regular `&nbsp;` characters.
	 *
	 * This mode allows for more precise handling of block fillers (so they do not leak into the editor content) but bloats the
	 * editor data with additional markup.
	 *
	 * This mode may be required by some features and will be turned on by them automatically.
	 *
	 * @param type Whether to use the default or marked `&nbsp;` block fillers.
	 */
	useFillerType( type: 'default' | 'marked' ): void;

	/**
	 * If `false`, comment nodes will be converted to `$comment`. Otherwise comment nodes are ignored.
	 */
	skipComments?: boolean;
}
