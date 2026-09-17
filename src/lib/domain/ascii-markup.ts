/**
 * ASCII diagram markup (design "AsciiDiagram markup" contract). Diagram art
 * is plain text with two inline highlight markers: `[[X]]` for the
 * secondary accent and `{{X}}` for the primary one. Both the surrounding
 * art and the marked spans are HTML-escaped before the markers are turned
 * into `<span>`s, so the diagrams stay safe to render with `{@html}`.
 */
function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderAsciiMarkup(art: string): string {
	return escapeHtml(art)
		.replace(/\[\[(.+?)\]\]/g, '<span class="hl2">$1</span>')
		.replace(/\{\{(.+?)\}\}/g, '<span class="hl">$1</span>');
}
