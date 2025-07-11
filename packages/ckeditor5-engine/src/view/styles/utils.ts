/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/**
 * @module engine/view/styles/utils
 */

import type { BoxStyleSides, StylePropertyDescriptor, StyleValue } from '../stylesmap.js';

const HEX_COLOR_REGEXP = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_REGEXP = /^rgb\([ ]?([0-9]{1,3}[ %]?,[ ]?){2,3}[0-9]{1,3}[ %]?\)$/i;
const RGBA_COLOR_REGEXP = /^rgba\([ ]?([0-9]{1,3}[ %]?,[ ]?){3}(1|[0-9]+%|[0]?\.?[0-9]+)\)$/i;
const HSL_COLOR_REGEXP = /^hsl\([ ]?([0-9]{1,3}[ %]?[,]?[ ]*){3}(1|[0-9]+%|[0]?\.?[0-9]+)?\)$/i;
const HSLA_COLOR_REGEXP = /^hsla\([ ]?([0-9]{1,3}[ %]?,[ ]?){2,3}(1|[0-9]+%|[0]?\.?[0-9]+)\)$/i;

// Note: This regexp hardcodes a single level of nested () for values such as `calc( var( ...) + ...)`.
// If this gets more complex, a proper parser should be used instead.
const CSS_SHORTHAND_VALUE_REGEXP = /\w+\((?:[^()]|\([^()]*\))*\)|\S+/gi;

const COLOR_NAMES = new Set( [
	// CSS Level 1
	'black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia',
	'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua',
	// CSS Level 2 (Revision 1)
	'orange',
	// CSS Color Module Level 3
	'aliceblue', 'antiquewhite', 'aquamarine', 'azure', 'beige', 'bisque', 'blanchedalmond', 'blueviolet', 'brown',
	'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
	'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
	'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
	'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
	'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
	'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
	'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
	'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
	'lightslategrey', 'lightsteelblue', 'lightyellow', 'limegreen', 'linen', 'magenta', 'mediumaquamarine',
	'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
	'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite',
	'oldlace', 'olivedrab', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
	'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
	'sandybrown', 'seagreen', 'seashell', 'sienna', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
	'springgreen', 'steelblue', 'tan', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'whitesmoke', 'yellowgreen',
	// CSS Color Module Level 3 (System Colors)
	'activeborder', 'activecaption', 'appworkspace', 'background', 'buttonface', 'buttonhighlight', 'buttonshadow',
	'buttontext', 'captiontext', 'graytext', 'highlight', 'highlighttext', 'inactiveborder', 'inactivecaption',
	'inactivecaptiontext', 'infobackground', 'infotext', 'menu', 'menutext', 'scrollbar', 'threeddarkshadow',
	'threedface', 'threedhighlight', 'threedlightshadow', 'threedshadow', 'window', 'windowframe', 'windowtext',
	// CSS Color Module Level 4
	'rebeccapurple',
	// Keywords
	'currentcolor', 'transparent'
] );

/**
 * Checks if string contains [color](https://developer.mozilla.org/en-US/docs/Web/CSS/color) CSS value.
 *
 * ```ts
 * isColorStyleValue( '#f00' );						// true
 * isColorStyleValue( '#AA00BB33' );				// true
 * isColorStyleValue( 'rgb(0, 0, 250)' );			// true
 * isColorStyleValue( 'hsla(240, 100%, 50%, .7)' );	// true
 * isColorStyleValue( 'deepskyblue' );				// true
 * ```
 *
 * **Note**: It does not support CSS Level 4 whitespace syntax, system colors and radius values for HSL colors.
 */
export function isColorStyleValue( string: string ): boolean {
	// As far as I was able to test checking some pre-conditions is faster than joining each test with ||.
	if ( string.startsWith( '#' ) ) {
		return HEX_COLOR_REGEXP.test( string );
	}

	if ( string.startsWith( 'rgb' ) ) {
		return RGB_COLOR_REGEXP.test( string ) || RGBA_COLOR_REGEXP.test( string );
	}

	if ( string.startsWith( 'hsl' ) ) {
		return HSL_COLOR_REGEXP.test( string ) || HSLA_COLOR_REGEXP.test( string );
	}

	// Array check > RegExp test.
	return COLOR_NAMES.has( string.toLowerCase() );
}

const lineStyleValues = [ 'none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset' ];

/**
 * Checks if string contains [line style](https://developer.mozilla.org/en-US/docs/Web/CSS/border-style) CSS value.
 */
export function isLineStyleValue( string: string ): boolean {
	return lineStyleValues.includes( string );
}

const lengthRegExp = /^([+-]?[0-9]*([.][0-9]+)?(px|cm|mm|in|pc|pt|ch|em|ex|rem|vh|vw|vmin|vmax)|0)$/;

/**
 * Checks if string contains [length](https://developer.mozilla.org/en-US/docs/Web/CSS/length) CSS value.
 */
export function isLengthStyleValue( string: string ): boolean {
	return lengthRegExp.test( string );
}

const PERCENTAGE_VALUE_REGEXP = /^[+-]?[0-9]*([.][0-9]+)?%$/;

/**
 * Checks if string contains [percentage](https://developer.mozilla.org/en-US/docs/Web/CSS/percentage) CSS value.
 */
export function isPercentageStyleValue( string: string ): boolean {
	return PERCENTAGE_VALUE_REGEXP.test( string );
}

const repeatValues = [ 'repeat-x', 'repeat-y', 'repeat', 'space', 'round', 'no-repeat' ];

/**
 * Checks if string contains [background repeat](https://developer.mozilla.org/en-US/docs/Web/CSS/background-repeat) CSS value.
 */
export function isRepeatStyleValue( string: string ): boolean {
	return repeatValues.includes( string );
}

const positionValues = [ 'center', 'top', 'bottom', 'left', 'right' ];

/**
 * Checks if string contains [background position](https://developer.mozilla.org/en-US/docs/Web/CSS/background-position) CSS value.
 */
export function isPositionStyleValue( string: string ): boolean {
	return positionValues.includes( string );
}

const attachmentValues = [ 'fixed', 'scroll', 'local' ];

/**
 * Checks if string contains [background attachment](https://developer.mozilla.org/en-US/docs/Web/CSS/background-attachment) CSS value.
 */
export function isAttachmentStyleValue( string: string ): boolean {
	return attachmentValues.includes( string );
}

const urlRegExp = /^url\(/;

/**
 * Checks if string contains [URL](https://developer.mozilla.org/en-US/docs/Web/CSS/url) CSS value.
 */
export function isURLStyleValue( string: string ): boolean {
	return urlRegExp.test( string );
}

/**
 * Parses box sides as individual values.
 */
export function getBoxSidesStyleValues( value: string = '' ): BoxStyleSides {
	if ( value === '' ) {
		return { top: undefined, right: undefined, bottom: undefined, left: undefined };
	}

	const values = getShorthandStylesValues( value );

	const top = values[ 0 ];
	const bottom = values[ 2 ] || top;
	const right = values[ 1 ] || top;
	const left = values[ 3 ] || right;

	return { top, bottom, right, left };
}

/**
 * Default reducer for CSS properties that concerns edges of a box
 * [shorthand](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties) notations:
 *
 * ```ts
 * stylesProcessor.setReducer( 'padding', getBoxSidesStyleValueReducer( 'padding' ) );
 * ```
 */
export function getBoxSidesStyleValueReducer( styleShorthand: string ) {
	return ( value: StyleValue ): Array<StylePropertyDescriptor> => {
		const { top, right, bottom, left } = value as BoxStyleSides;

		const reduced: Array<StylePropertyDescriptor> = [];

		if ( ![ top, right, left, bottom ].every( value => !!value ) ) {
			if ( top ) {
				reduced.push( [ styleShorthand + '-top', top ] );
			}

			if ( right ) {
				reduced.push( [ styleShorthand + '-right', right ] );
			}

			if ( bottom ) {
				reduced.push( [ styleShorthand + '-bottom', bottom ] );
			}

			if ( left ) {
				reduced.push( [ styleShorthand + '-left', left ] );
			}
		} else {
			reduced.push( [ styleShorthand, getBoxSidesStyleShorthandValue( value as BoxStyleSides ) ] );
		}

		return reduced;
	};
}

/**
 * Returns a [shorthand](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties) notation
 * of a CSS property value.
 *
 * ```ts
 * getBoxSidesStyleShorthandValue( { top: '1px', right: '1px', bottom: '2px', left: '1px' } );
 * // will return '1px 1px 2px'
 * ```
 */
export function getBoxSidesStyleShorthandValue( { top, right, bottom, left }: BoxStyleSides ): string {
	const out = [];

	if ( left !== right ) {
		out.push( top, right, bottom, left );
	} else if ( bottom !== top ) {
		out.push( top, right, bottom );
	} else if ( right !== top ) {
		out.push( top, right );
	} else {
		out.push( top );
	}

	return out.join( ' ' );
}

/**
 * Creates a normalizer for a [shorthand](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties) 1-to-4 value.
 *
 * ```ts
 * stylesProcessor.setNormalizer( 'margin', getPositionStyleShorthandNormalizer( 'margin' ) );
 * ```
 */
export function getPositionStyleShorthandNormalizer( shorthand: string ) {
	return ( value: string ): { path: string; value: BoxStyleSides } => {
		return {
			path: shorthand,
			value: getBoxSidesStyleValues( value )
		};
	};
}

/**
 * Parses parts of a 1-to-4 value notation - handles some CSS values with spaces (like RGB()).
 *
 * ```ts
 * getShorthandStylesValues( 'red blue RGB(0, 0, 0)');
 * // will return [ 'red', 'blue', 'RGB(0, 0, 0)' ]
 * ```
 */
export function getShorthandStylesValues( string: string ): Array<string> {
	const matches = string.trim().slice( 0, 1500 ).matchAll( CSS_SHORTHAND_VALUE_REGEXP );

	return Array.from( matches ).map( i => i[ 0 ] );
}
