/**
 * Client-side documentation search.
 *
 * How it works:
 *   1. On page load, builds a search index from every element that has a
 *      `data-search-content` attribute.  Each entry stores the element's
 *      text content and an optional title pulled from `data-search-title`
 *      (falls back to the nearest heading or the page <title>).
 *   2. As the user types in the search input, the query is matched against
 *      every index entry (case-insensitive substring).
 *   3. Matching results are rendered in a dropdown with highlighted terms.
 *   4. Clicking a result scrolls to / navigates to the matching element.
 *
 * Expected DOM contract:
 *   - An <input> with id="docs-search" (the search box).
 *   - A container with id="search-results" and class "search-results"
 *     (the dropdown).
 *   - Content elements decorated with `data-search-content` (and
 *     optionally `data-search-title`).
 */

(function () {
    "use strict";

    /* ---------------------------------------------------------------
       Configuration
       --------------------------------------------------------------- */

    /** Minimum characters before a search is triggered. */
    var MIN_QUERY_LENGTH = 2;

    /** Maximum number of results shown in the dropdown. */
    var MAX_RESULTS = 20;

    /** Maximum length of the snippet shown under each result title. */
    var SNIPPET_LENGTH = 120;

    /* ---------------------------------------------------------------
       Index
       --------------------------------------------------------------- */

    /**
     * A single index entry.
     * @typedef {Object} SearchEntry
     * @property {string} title   - Human-readable title for the result.
     * @property {string} content - Searchable text (lower-cased).
     * @property {string} raw     - Original text (for snippet extraction).
     * @property {HTMLElement} el - The source DOM element.
     */

    /** @type {SearchEntry[]} */
    var index = [];

    /**
     * Build the search index by scanning the DOM for elements with
     * `data-search-content`.
     */
    function buildIndex() {
        var elements = document.querySelectorAll("[data-search-content]");

        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var raw = (el.textContent || "").trim();
            var title = el.getAttribute("data-search-title") || findTitle(el);

            index.push({
                title: title,
                content: (title + " " + raw).toLowerCase(),
                raw: raw,
                el: el
            });
        }
    }

    /**
     * Determine a reasonable title for the given element by walking up
     * the DOM to find the nearest heading, or falling back to the page
     * <title>.
     *
     * @param {HTMLElement} el
     * @returns {string}
     */
    function findTitle(el) {
        // Walk previous siblings and parents looking for a heading.
        var node = el;
        while (node) {
            // Check previous siblings first.
            var prev = node.previousElementSibling;
            while (prev) {
                if (/^H[1-6]$/.test(prev.tagName)) {
                    return prev.textContent.trim();
                }
                prev = prev.previousElementSibling;
            }
            node = node.parentElement;
        }
        // Fallback: page title.
        return document.title || "Untitled";
    }

    /* ---------------------------------------------------------------
       Search logic
       --------------------------------------------------------------- */

    /**
     * Search the index for entries matching the given query.
     *
     * @param {string} query - Raw user input.
     * @returns {SearchEntry[]} Matching entries (up to MAX_RESULTS).
     */
    function search(query) {
        var q = query.toLowerCase().trim();
        if (q.length < MIN_QUERY_LENGTH) {
            return [];
        }

        var terms = q.split(/\s+/);
        var results = [];

        for (var i = 0; i < index.length; i++) {
            var entry = index[i];
            var matched = true;

            // Every term must appear somewhere in the entry.
            for (var t = 0; t < terms.length; t++) {
                if (entry.content.indexOf(terms[t]) === -1) {
                    matched = false;
                    break;
                }
            }

            if (matched) {
                results.push(entry);
                if (results.length >= MAX_RESULTS) {
                    break;
                }
            }
        }

        return results;
    }

    /* ---------------------------------------------------------------
       Rendering
       --------------------------------------------------------------- */

    /**
     * Escape HTML special characters.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Highlight all occurrences of `terms` inside `text` by wrapping
     * them in <span class="search-highlight">.
     *
     * @param {string} text  - Plain text to highlight within.
     * @param {string[]} terms - Lowercase search terms.
     * @returns {string} HTML string with highlights.
     */
    function highlightTerms(text, terms) {
        if (!terms.length) return escapeHtml(text);

        // Build a regex that matches any of the terms (case-insensitive).
        var escaped = terms.map(function (t) {
            return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        var re = new RegExp("(" + escaped.join("|") + ")", "gi");

        // Split on matches, escape non-match parts, wrap matches.
        var parts = text.split(re);
        var html = "";
        for (var i = 0; i < parts.length; i++) {
            if (re.test(parts[i])) {
                html += '<span class="search-highlight">' + escapeHtml(parts[i]) + "</span>";
            } else {
                html += escapeHtml(parts[i]);
            }
            // Reset lastIndex since we reuse the regex.
            re.lastIndex = 0;
        }
        return html;
    }

    /**
     * Extract a short snippet from `text` centred around the first
     * occurrence of any term.
     *
     * @param {string} text
     * @param {string[]} terms
     * @returns {string}
     */
    function extractSnippet(text, terms) {
        var lower = text.toLowerCase();
        var earliest = text.length;

        for (var i = 0; i < terms.length; i++) {
            var pos = lower.indexOf(terms[i]);
            if (pos !== -1 && pos < earliest) {
                earliest = pos;
            }
        }

        var start = Math.max(0, earliest - 30);
        var end = Math.min(text.length, start + SNIPPET_LENGTH);
        var snippet = text.slice(start, end).trim();

        if (start > 0) snippet = "..." + snippet;
        if (end < text.length) snippet = snippet + "...";

        return snippet;
    }

    /**
     * Render search results into the dropdown container.
     *
     * @param {SearchEntry[]} results
     * @param {string} query
     * @param {HTMLElement} container
     */
    function renderResults(results, query, container) {
        container.innerHTML = "";

        if (results.length === 0) {
            container.classList.remove("active");
            return;
        }

        var terms = query.toLowerCase().trim().split(/\s+/);

        for (var i = 0; i < results.length; i++) {
            var entry = results[i];
            var item = document.createElement("div");
            item.className = "result-item";
            item.setAttribute("tabindex", "0");
            item.setAttribute("role", "option");

            var titleEl = document.createElement("div");
            titleEl.className = "result-title";
            titleEl.innerHTML = highlightTerms(entry.title, terms);

            var snippetEl = document.createElement("div");
            snippetEl.className = "result-snippet";
            var snippet = extractSnippet(entry.raw, terms);
            snippetEl.innerHTML = highlightTerms(snippet, terms);

            item.appendChild(titleEl);
            item.appendChild(snippetEl);

            // Closure to capture entry reference.
            (function (target) {
                item.addEventListener("click", function () {
                    navigateTo(target);
                });
                item.addEventListener("keydown", function (e) {
                    if (e.key === "Enter") {
                        navigateTo(target);
                    }
                });
            })(entry.el);

            container.appendChild(item);
        }

        container.classList.add("active");
    }

    /**
     * Scroll to (or navigate to) the element associated with a search
     * result.
     *
     * @param {HTMLElement} el
     */
    function navigateTo(el) {
        // If the element has an id, use a hash link for clean URLs.
        if (el.id) {
            window.location.hash = "#" + el.id;
        }
        el.scrollIntoView({ behavior: "smooth", block: "start" });

        // Briefly flash the element to draw attention.
        el.style.transition = "background 0.3s";
        el.style.background = "#fff3a8";
        setTimeout(function () {
            el.style.background = "";
        }, 1500);
    }

    /* ---------------------------------------------------------------
       Initialisation & Event Binding
       --------------------------------------------------------------- */

    function init() {
        var input = document.getElementById("docs-search");
        var resultsContainer = document.getElementById("search-results");

        if (!input || !resultsContainer) {
            // Search elements not present on this page; nothing to do.
            return;
        }

        buildIndex();

        // Live search on input.
        input.addEventListener("input", function () {
            var query = input.value;
            var results = search(query);
            renderResults(results, query, resultsContainer);
        });

        // Close dropdown when clicking outside.
        document.addEventListener("click", function (e) {
            if (!resultsContainer.contains(e.target) && e.target !== input) {
                resultsContainer.classList.remove("active");
            }
        });

        // Re-open dropdown when the input is focused and has a value.
        input.addEventListener("focus", function () {
            if (input.value.trim().length >= MIN_QUERY_LENGTH) {
                var results = search(input.value);
                renderResults(results, input.value, resultsContainer);
            }
        });

        // Keyboard: Escape closes the dropdown.
        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                resultsContainer.classList.remove("active");
                input.blur();
            }
        });
    }

    // Run when the DOM is ready.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
