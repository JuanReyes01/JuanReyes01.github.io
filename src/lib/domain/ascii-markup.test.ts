import { describe, it, expect } from 'vitest';
import { renderAsciiMarkup } from './ascii-markup';

describe('renderAsciiMarkup', () => {
	it('wraps [[...]] spans as the secondary highlight', () => {
		expect(renderAsciiMarkup('[[FEEDER]]')).toBe('<span class="hl2">FEEDER</span>');
	});

	it('wraps {{...}} spans as the primary highlight', () => {
		expect(renderAsciiMarkup('{{POLARS CORE}}')).toBe('<span class="hl">POLARS CORE</span>');
	});

	it('leaves plain text with no markers untouched', () => {
		expect(renderAsciiMarkup('┌──────┐')).toBe('┌──────┐');
	});

	it('escapes HTML special characters outside of markers', () => {
		expect(renderAsciiMarkup('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
	});

	it('escapes HTML special characters inside marked spans', () => {
		expect(renderAsciiMarkup('[[a < b]]')).toBe('<span class="hl2">a &lt; b</span>');
	});

	it('renders both marker kinds in the same diagram', () => {
		expect(renderAsciiMarkup('{{A}} -> [[B]]')).toBe(
			'<span class="hl">A</span> -&gt; <span class="hl2">B</span>'
		);
	});
});
