---
category: update-guides
meta-title: Update to version 35.x | CKEditor 5 Documentation
meta-description: Follow the guide to update CKEditor 5 to version 35.x, including key changes, migration tips, and compatibility considerations.
menu-title: Update to v35.x
order: 89
modified_at: 2022-10-05
---

# Update to CKEditor&nbsp;5 v35.x

<info-box>
	When updating your CKEditor&nbsp;5 installation, ensure **all the packages are the same version** to avoid errors.

	For custom builds, you may try removing the `package-lock.json` or `yarn.lock` files (if applicable) and reinstalling all packages before rebuilding the editor. For best results, make sure you use the most recent package versions.
</info-box>

## Update to CKEditor&nbsp;5 v35.2.0

_Released on October 5, 2022._

For the entire list of changes introduced in version 35.2.0, see the [release notes for CKEditor&nbsp;5 v35.2.0](https://github.com/ckeditor/ckeditor5/releases/tag/v35.2.0).

Below are the most important changes that require your attention when upgrading to CKEditor&nbsp;5 v35.2.0.

### Introducing external comments

In this release, we are introducing external comments and suggestions. Currently, they are used by the import from Word feature. However, other features may use them in the future as well.

External comments and suggestions display their content, author name, and date as provided by an external source (like a Word document).

Even if you do not plan to use the import from Word feature, we recommend following this migration guide. It will make your integration ready in case you decide to use external comments or suggestions in the future.

#### Saving external comments and suggestions data

<info-box>
	This information applies only to integrations that use the **asynchronous** collaboration features.
</info-box>

The external data for external comments and suggestions is kept in the newly added `@external` {@link module:comments/comments/commentsrepository~Comment#attributes attribute}. It is an object with two fields: `authorName` (`String`) and `createdAt` (`Date`).

Other properties and attributes for comments and suggestions are used in the regular way. The `authorId` property is set to the author who performed the import.

The external data is shown in the UI, but it is not authenticated (as it comes from an external source). Because of that, it is important to introduce some security measures when saving external comments and suggestions:

* The `@external` attribute should be read-only and possible to set only when a comment or suggestion is created.
* Other comment and suggestion properties (like `content`) should be read-only as well, if the `@external` attribute is set.

#### Templates for {@link module:comments/comments/ui/view/commentview~CommentView#getTemplate `CommentView`} and {@link module:track-changes/ui/view/suggestionthreadview~SuggestionThreadView#getTemplate `SuggestionThreadView`} have changed

<info-box>
	This information applies only to integrations that use custom annotation views or templates.
</info-box>

Since the data in external comments and suggestions is not authenticated, we have added a label that informs users that a given item comes from an external source.

This changes the {@link module:comments/comments/ui/view/commentview~CommentView#getTemplate `CommentView` template} and the {@link module:track-changes/ui/view/suggestionthreadview~SuggestionThreadView#getTemplate `SuggestionThreadView` template}. The label is added at the end of these templates. Check the new templates to see whether this change affects your custom view.

### Comment input editor is now loaded on demand

<info-box>
	This information applies only to custom features depending on the comment input editor.
</info-box>

The comment input editor is now initialized on demand (when the comment view is focused for the first time) instead of when it is rendered.

If your custom feature somehow depends on the comment input editor, you may need to update it.

### You must register custom annotations in the {@link module:comments/annotations/editorannotations~EditorAnnotations `EditorAnnotations`} plugin

<info-box>
	This information applies only to custom features that create their own {@link module:comments/annotations/annotation~Annotation `Annotation`} instances.
</info-box>

The {@link module:comments/annotations/annotation~Annotation `Annotation`} instances **that target a marker or a DOM element inside the editor editable** must now be manually registered. You need to do this using {@link module:comments/annotations/editorannotations~EditorAnnotations#registerAnnotation `EditorAnnotations#registerAnnotation()`} to provide correct focus tracking between the annotation and the editor.

```js
// Before:
const annotation = new Annotation( ... );
editor.plugins.get( 'Annotations' ).add( annotation );

// After:
const annotation = new Annotation( ... );
editor.plugins.get( 'EditorAnnotations' ).registerAnnotation( annotation );
editor.plugins.get( 'Annotations' ).add( annotation );
```

### Icons paths changed

Among other changes, some icons have been moved around the project. Observe these changes if you use custom UI elements that call these icons.

* The `bold` icon was moved to the `@ckeditor/ckeditor5-core` package.
* The `paragraph` icon was moved to the `@ckeditor/ckeditor5-core` package.

The rest of the import path remained unchanged (`/theme/icons/`).

## Update to CKEditor&nbsp;5 v35.1.0

_Released on August 31, 2022._

For the entire list of changes introduced in version 35.1.0, see the [release notes for CKEditor&nbsp;5 v35.1.0](https://github.com/ckeditor/ckeditor5/releases/tag/v35.1.0).

Below are the most important changes that require your attention when upgrading to CKEditor&nbsp;5 v35.1.0.

### Changes to API providing accessible navigation between editing roots and toolbars on <kbd>Alt</kbd>+<kbd>F10</kbd> and <kbd>Esc</kbd> keystrokes

<info-box>
	This information applies only to integrators who develop custom editor creators from scratch by using the {@link module:core/editor/editor~Editor} and {@link module:ui/editorui/editorui~EditorUI} classes as building blocks.
</info-box>

* The `enableToolbarKeyboardFocus()` helper that allowed the navigation was removed. To bring this functionality back, use the {@link module:ui/editorui/editorui~EditorUI#addToolbar} method instead.
* Editable elements are now automatically added to the {@link module:utils/focustracker~FocusTracker main focus tracker}. You should not add them individually.

**Before**:

```js
import { EditorUI } from 'ckeditor5/src/core';

export default class MyEditorUI extends EditorUI {
	// ...

	init() {
		const view = this.view;
		const editableElement = view.editable.element;
		const toolbarViewInstance = this.view.toolbar;

		// ...

		this.setEditableElement( 'editableName', editableElement );

		this.focusTracker.add( editableElement );

		enableToolbarKeyboardFocus( {
			// ...

			toolbar: toolbarViewInstance
		} );

		// ...
	}
}
```

**After**:

```js
import { EditorUI } from 'ckeditor5/src/core';
// Or `import { EditorUI } from 'ckeditor5/src/ui';` if you update to v36.x;

export default class MyEditorUI extends EditorUI {
	// ...

	init() {
		const view = this.view;
		const editableElement = view.editable.element;
		const toolbarViewInstance = this.view.toolbar;

		// ...

		// Note: You should not add the editable element to the focus tracker here.
		// This is handled internally by the EditorUI#setEditableElement() method.
		this.setEditableElement( 'editableName', editableElement );

		// Note: Add the toolbar to enable Alt+F10 navigation.
		// The rest (e.g. the Esc key handling) is handled by the EditorUI#setEditableElement() method.
		this.addToolbar( toolbarViewInstance );

		// ...
	}
}
```

### Removal of the `TooltipView` class and changes to the tooltip system

<info-box>
	This change does not affect integrations that configure tooltips of core UI components, for instance {@link module:ui/button/buttonview~ButtonView#tooltip}.
</info-box>

Starting with v35.1.0, the `TooltipView` UI component was removed from the [ckeditor5-ui](https://www.npmjs.com/package/@ckeditor/ckeditor5-ui) package. Instead, a new tooltip API is available based on the `data-cke-tooltip-*` DOM element attributes.

Your integration may create instances of `TooltipView` and inject them into the DOM in a similar way:

```js
// ❌ Old tooltip API.
import { TooltipView } from 'ckeditor5/src/ui';

const tooltip = new TooltipView();

tooltip.text = 'Tooltip text';
tooltip.position = 'sw';
tooltip.render();

DOMElementThatNeedsTooltip.appendChild( tooltip.element );
```

```css
/* ❌ Old tooltip API. */
.dom-element-that-needs-tooltip:hover .ck-tooltip {
	visibility: visible;
	opacity: 1;
}
```

If this is the case, you should now use the `data-cke-tooltip-*` attributes and let the editor's built–in {@link module:ui/tooltipmanager~TooltipManager} handle the rest:

```js
// ✅ New tooltip API.
DOMElementThatNeedsTooltip.dataset.ckeTooltipText = 'Tooltip text';
DOMElementThatNeedsTooltip.dataset.ckeTooltipPosition = 'sw';
```

You do not need to worry about showing and hiding your custom tooltips in CSS. The `TooltipManager` will attach a tooltip whenever the user moves the mouse or brings the focus to a DOM element with the `data-cke-tooltip-*` attributes. For more information, refer to the {@link module:ui/tooltipmanager~TooltipManager} API.

### Changes to the color palette in the UI

In this release, we have made several changes to improve the accessibility and contrast of the UI. Since we understand that some integrations may prefer the earlier look of the editor, we prepared a CSS snippet you can use to bring it back.

For the best results, set the custom properties listed below after the main editor style sheets. For more information, check out the {@link framework/theme-customization theme customization guide}.

```css
:root {
	--ck-color-base-border: 						hsl(0, 0%, 77%);
	--ck-color-base-action: 						hsl(104, 44%, 48%);
	--ck-color-base-active: 						hsl(208, 88%, 52%);
	--ck-color-base-active-focus:					hsl(208, 88%, 47%);
	--ck-color-focus-border-coordinates: 			208, 79%, 51%;
	--ck-color-focus-outer-shadow: 					hsl(207, 89%, 86%);

	--ck-color-button-default-hover-background: 	hsl(0, 0%, 90%);
	--ck-color-button-default-active-background: 	hsl(0, 0%, 85%);
	--ck-color-button-default-active-shadow: 		hsl(0, 0%, 75%);

	--ck-color-button-on-background: 				hsl(0, 0%, 87%);
	--ck-color-button-on-hover-background: 			hsl(0, 0%, 77%);
	--ck-color-button-on-active-background: 		hsl(0, 0%, 73%);
	--ck-color-button-on-active-shadow: 			hsl(0, 0%, 63%);
	--ck-color-button-on-disabled-background: 		hsl(0, 0%, 87%);
	--ck-color-button-on-color:						var(--ck-color-text);

	--ck-color-button-action-hover-background: 		hsl(104, 44%, 43%);
	--ck-color-button-action-active-background: 	hsl(104, 44%, 41%);
	--ck-color-button-action-active-shadow: 		hsl(104, 44%, 36%);

	--ck-color-switch-button-off-background:		hsl(0, 0%, 69%);
	--ck-color-switch-button-off-hover-background:	hsl(0, 0%, 64%);
	--ck-color-switch-button-on-hover-background: 	hsl(104, 44%, 43%);

	--ck-color-input-border: 						hsl(0, 0%, 78%);
	--ck-color-input-disabled-border: 				hsl(0, 0%, 78%);

	--ck-color-list-button-on-background: 			var(--ck-color-base-active);
	--ck-color-list-button-on-background-focus: 	var(--ck-color-base-active-focus);

	--ck-color-toolbar-background: 					var(--ck-color-base-foreground);
}
```

### Renaming the properties of `BalloonPanelView`

The static properties of `BalloonPanelView` were renamed.

The `BalloonPanelView.arrowVerticalOffset` static property is now `arrowHeightOffset` and `BalloonPanelView.arrowHorizontalOffset` is now `arrowSideOffset`.

## Update to CKEditor&nbsp;5 v35.0.0

_Released on August 3, 2022._

For the entire list of changes introduced in version 35.0.0, see the [release notes for CKEditor&nbsp;5 v35.0.0](https://github.com/ckeditor/ckeditor5/releases/tag/v35.0.0).

Below are the most important changes that require your attention when upgrading to CKEditor&nbsp;5 v35.0.0.

### The source element is not updated automatically after the editor destruction

The last version of CKEditor&nbsp;5 changes the default behavior of the source element after the editor is destroyed (when `editor.destroy()` is called). Before, the source element was updated with the output coming from `editor.getData()`. Now, the source element becomes empty after the editor is destroyed and it is not updated anymore.

However, this behavior is configurable. You can enable it with the {@link module:core/editor/editorconfig~EditorConfig#updateSourceElementOnDestroy `updateSourceElementOnDestroy`} configuration option:

```js
ClassicEditor
	.create( sourceElement, {
		// ...
		updateSourceElementOnDestroy: true
	} );
```

<info-box warning>
	Depending on the plugins you use, enabling the `updateSourceElementOnDestroy` option in your configuration might have some security implications. While the editing view is secured, there might be some unsafe content in the data output, so enable this option only if you know what you are doing. Be extra careful when using the Markdown, General HTML Support, and HTML embed features.
</info-box>

### Dropdown focus is moved back to the dropdown button after choosing an option

Due to the ongoing accessibility improvements, the default behavior of the {@link module:ui/dropdown/dropdownview~DropdownView dropdown UI component} was changed. From now on, by default, after choosing an option from a dropdown (either by mouse or keyboard), the focus will automatically move to the dropdown button.

This default behavior of the dropdown component needs to be overridden in scenarios where the focus should move back to the editing area. An example of such a feature would be the "Heading" dropdown. Choosing one of the options should result in the focus returning to the editing area instead of the button.

You can customize this behavior by using the listener on the dropdown's {@link module:ui/dropdown/dropdownview~DropdownView#event:execute `execute` event}, e.g.:

```js
// Option 1.
// If the `execute` event is delegated to the dropdown, one listener can handle both:
// executing the command (assuming the dropdown executes it) and focusing the editor editing view.
dropdownView.on( 'execute', () => {
	editor.execute( 'myCommand' );
	editor.editing.view.focus();
} );

// Option 2.
// Otherwise, a dedicated listener may need to be added.
buttonInsideADropdown.on( 'execute', () => {
	editor.execute( 'myCommand' );
} );

dropdownView.on( 'execute', () => {
	editor.editing.view.focus();
} );
```

### There is now TypeScript code on GitHub (and how it affects your build)

Starting from v35.0.0, the first CKEditor&nbsp;5 package (namely: `@ckeditor/ckeditor5-utils`) is developed in TypeScript. This is the first step of the [migration to TypeScript](https://github.com/ckeditor/ckeditor5/issues/11704).

#### Whom does it affect

It affects you **only if** you use the [source code directly from the Git repository (GitHub)](https://github.com/ckeditor/ckeditor5). If you use it via any other channel (npm, CDN, ZIP, etc.), this change is transparent for you as we publish only JavaScript code there.

#### How does it affect you

For instance, if you happen to have a custom CKEditor&nbsp;5 build that installs its dependencies from the Git repository, you will need to update your webpack configuration to support the TypeScript code.

You can find the inspiration on how to change your configuration in [this commit](https://github.com/ckeditor/ckeditor5/commit/1dd4075983d97c61b1f668add764525c7fcf2a2d) (this one makes the discussed change in our builds).
