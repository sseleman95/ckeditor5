---
category: framework-deep-dive-conversion-helpers
menu-title: Introduction
meta-title: Introduction to conversion helpers | CKEditor 5 Framework Documentation
meta-description: Explore CKEditor 5 conversion helpers that simplify writing upcast and downcast converters for efficient model-view synchronization.
order: 10
since: 33.0.0
modified_at: 2022-03-02
---

# Introduction to conversion helpers

The editor supports a vast amount of the most commonly used HTML elements via {@link features/index existing editor features} out-of-the-box.

If your aim is to easily enable common HTML features that are not explicitly supported by the dedicated CKEditor&nbsp;5 features, use the {@link features/general-html-support General HTML Support feature}.

There are, however, cases where you might want to provide a rich editing experience for a custom HTML markup. The conversion helpers are the way to achieve that. Read the following guides to learn how to use them.

## Helpers by category

* **{@link framework/deep-dive/conversion/helpers/downcast Downcast helpers &ndash; model to view conversion}**

* **{@link framework/deep-dive/conversion/helpers/upcast Upcast helpers &ndash; view to model conversion}**
