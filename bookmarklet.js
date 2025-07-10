// Bookmarklet JavaScript: Facebook Page Scraper v7.2 (Non-Minified)
// This script is designed to extract specific information from a Facebook photo page,
// including the main photo URL, post author, date, location, engagement metrics,
// and comments with their avatars.

"use strict";

    /**
     * Finds the core container elements on the Facebook page needed for scraping.
     * This includes the date permalink element, the first comment article,
     * and the common ancestor that holds these main sections.
     * @returns {object|null} An object containing references to headerDiv, statsDiv,
     * commentsDiv, and datePermalink, or null if any critical element is not found.
     */
    function findCoreContainers() {
        console.log("--- Finding Core Containers ---");

        // 1. Find the permalink for the date.
        // User-specified rule: Find the first hyperlink that includes "/photo/" in its href,
        // specifically within the element with role="complementary".
        console.log("Searching for date permalink...");
        const complementaryElement = document.querySelector('div[role="complementary"]');

        if (!complementaryElement) {
            console.error("Could not find the element with role='complementary'. Orientation failed.");
            return null;
        }
        console.log("Found complementary element:", complementaryElement);

        const datePermalink = Array.from(complementaryElement.querySelectorAll("a")).find(a =>
            a.href.includes("/photo/")
        );

        if (!datePermalink) {
            console.error("Could not find the unique date permalink containing '/photo/' within the complementary element. Orientation failed.");
            return null;
        }
        console.log("Found date permalink element:", datePermalink);

        // 2. Find the first comment article. This helps in identifying the main content block.
        console.log("Searching for first comment article...");
        const firstCommentArticle = document.querySelector('div[role="article"]');

        if (!firstCommentArticle) {
            console.error("Could not find any comment articles. Orientation failed.");
            return null;
        }
        console.log("Found first comment article:", firstCommentArticle);

        // 3. Find the common ancestor that contains both the date permalink and the first comment.
        // This ancestor is expected to have 4 DIV children representing different sections of the post.
        const datePermalinkAncestors = new Set();
        let current = datePermalink.parentElement;
        while (current) {
            datePermalinkAncestors.add(current);
            current = current.parentElement;
        }

        let commonAncestor = null;
        current = firstCommentArticle.parentElement;
        while (current) {
            if (datePermalinkAncestors.has(current)) {
                // Check if this common ancestor has exactly 4 direct DIV children
                const divChildren = Array.from(current.children).filter(el => el.tagName === "DIV");
                if (divChildren.length === 4) {
                    commonAncestor = current;
                    break;
                }
            }
            current = current.parentElement;
        }

        if (!commonAncestor) {
            console.error("Could not find a common ancestor with 4 DIV children.");
            return null;
        }

        // Assign the found DIV children to meaningful names based on their expected content.
        const divChildren = Array.from(commonAncestor.children).filter(el => el.tagName === "DIV");
        return {
            headerDiv: divChildren[0],    // Expected to contain post author/location
            statsDiv: divChildren[1],     // Expected to contain likes/comments count
            commentsDiv: divChildren[3],  // Expected to contain comments section
            datePermalink: datePermalink  // The date permalink element itself
        };
    }

    /**
     * Scrapes the URL of the main photo from the page.
     * It now iterates through all 'div[role="main"]' elements, checks if they are visible,
     * and then looks for the image within the visible main div.
     * @returns {string} The URL of the main photo, or a "NOT_FOUND" string if not found.
     */
    function scrapeMainPhoto() {
        console.log("Attempting to find the visible div[role='main'] containing the image...");
        const mainDivs = document.querySelectorAll('div[role="main"]');

        if (mainDivs.length === 0) {
            console.log("No div[role='main'] elements found.");
            return "PHOTO_URL_NOT_FOUND_NO_MAIN_DIV";
        }

        const imageSelector = 'img[data-visualcompletion="media-vc-image"]';
        let mainPhotoUrl = null;

        for (let i = 0; i < mainDivs.length; i++) {
            const currentMainDiv = mainDivs[i];
            // Check if the div is visible (has a non-zero offsetHeight or clientHeight)
            if (currentMainDiv.offsetHeight > 0 || currentMainDiv.clientHeight > 0) {
                console.log(`Checking visible div[role='main'] #${i + 1}:`, currentMainDiv);
                const mainPhotoEl = currentMainDiv.querySelector(imageSelector);
                if (mainPhotoEl) {
                    mainPhotoUrl = mainPhotoEl.src;
                    console.log("Image found in visible div[role='main']:", mainPhotoEl);
                    break; // Found the image in a visible main div, stop searching
                }
            }
        }

        if (!mainPhotoUrl) {
            console.log("Image not found in any visible div[role='main'] with selector:", imageSelector);
            return "PHOTO_URL_NOT_FOUND_NO_IMAGE_IN_VISIBLE_MAIN_DIV";
        }
        return mainPhotoUrl;
    }

    /**
     * Scrapes the post date from the provided date permalink element.
     * Handles cases where the date might be split by single-character spans (e.g., "8h").
     * @param {HTMLElement} datePermalink - The HTML element containing the date.
     * @returns {string} The extracted post date, or "DATE_NOT_FOUND".
     */
    function scrapePostDate(datePermalink) {
        if (!datePermalink) {
            return "DATE_NOT_FOUND";
        }

        // Try to find single-character spans, which often indicate relative dates (e.g., "8h", "1d")
        const singleCharSpans = Array.from(datePermalink.querySelectorAll("span"))
                                .filter(span => span.textContent.trim().length === 1);

        if (singleCharSpans.length === 0) {
            // If no single-character spans, assume the direct text content is the date
            return datePermalink.textContent.trim() || "DATE_NOT_FOUND";
        }

        // If single-character spans are found, reconstruct the date based on their position
        const sortedSpans = singleCharSpans.map(span => {
            const rect = span.getBoundingClientRect();
            return { text: span.textContent, y: rect.top, x: rect.left };
        }).sort((a, b) => {
            // Sort primarily by Y-coordinate, then by X-coordinate for elements on the same line
            if (Math.abs(a.y - b.y) > 5) { // Allow for slight vertical misalignment
                return a.y - b.y;
            }
            return a.x - b.x;
        });

        if (sortedSpans.length > 0) {
            // Filter elements that are on the same "line" as the first element
            const firstLineY = sortedSpans[0].y;
            const dateParts = sortedSpans.filter(span => Math.abs(span.y - firstLineY) < 5)
                                         .reduce((acc, current, index, array) => {
                const currentText = current.text;
                if (index === 0) {
                    return currentText;
                }
                const prevText = array[index - 1].text;
                // Add a space if the previous part was a number and the current is not, or vice versa
                // This helps in cases like "8h" vs "8 h"
                return (/\d/.test(prevText) !== /\d/.test(currentText)) ? acc + " " + currentText : acc + currentText;
            }, "");
            return dateParts;
        }

        return "DATE_NOT_FOUND";
    }

    /**
     * Scrapes the post author and location from the header division.
     * @param {HTMLElement} headerDiv - The HTML element containing author and location.
     * @param {HTMLElement} datePermalink - The date permalink element (used to exclude it from location search).
     * @returns {object} An object with postAuthor and postLocation.
     */
    function scrapePostAuthorAndMeta(headerDiv, datePermalink) {
        if (!headerDiv) {
            return { postAuthor: "AUTHOR_NOT_FOUND", postLocation: "LOCATION_NOT_FOUND" };
        }

        // Author is typically in an h2 > a tag
        const authorLink = headerDiv.querySelector("h2 a");
        const postAuthor = authorLink ? authorLink.textContent.trim() : "AUTHOR_NOT_FOUND";

        // Location is typically another link in the header, not the author link or date permalink
        let postLocation = "LOCATION_NOT_FOUND";
        const locationLink = Array.from(headerDiv.querySelectorAll("a")).find(a =>
            a !== authorLink && a !== datePermalink && a.textContent.trim().length > 0
        );
        if (locationLink) {
            postLocation = locationLink.textContent.trim();
        }

        return { postAuthor, postLocation };
    }

    /**
     * Scrapes engagement metrics (likes and total comments) from the stats division.
     * @param {HTMLElement} statsDiv - The HTML element containing engagement numbers.
     * @returns {object} An object with likes (firstLiker, otherCount) and totalComments.
     */
    function scrapeEngagement(statsDiv) {
        let likes = { firstLiker: "", otherCount: 0 };
        let totalComments = 0;

        if (!statsDiv) {
            return { likes, totalComments };
        }

        const statsText = statsDiv.innerText;

        // Attempt to parse numbers from the innerText
        const numbers = statsText.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            // Heuristic: first number is often "otherCount" for likes, last is "totalComments"
            likes.otherCount = parseInt(numbers[0], 10) || 0;
            if (numbers.length > 1) {
                totalComments = parseInt(numbers[numbers.length - 1], 10) || 0;
            } else if (/comment/i.test(statsDiv.innerText)) {
                // If only one number and "comment" is in text, assume it's total comments
                totalComments = likes.otherCount;
                likes.otherCount = 0; // Reset otherCount if it was actually comments
            }
        }

        // Look for the specific aria-label for likers to get "firstLiker"
        const likersElement = statsDiv.querySelector('[aria-label*="See who reacted"]');
        if (likersElement) {
            const likersText = likersElement.innerText.trim();
            if (likersText) {
                const match = likersText.match(/(.+) and ([\d,]+) others?/);
                if (match) {
                    likes.firstLiker = match[1].trim();
                    likes.otherCount = parseInt(match[2].replace(/,/g, ""), 10);
                } else if (!/^\d+$/.test(likersText)) {
                    // If it's not just a number, assume it's the first liker's name
                    likes.firstLiker = likersText;
                }
            }
        }

        return { likes, totalComments };
    }

    /**
     * Scrapes comments and their associated avatars from the comments division.
     * Builds a nested structure for replies and collects avatar URLs.
     * @param {HTMLElement} commentsDiv - The HTML element containing comments.
     * @param {string} postAuthorName - The name of the post author, to associate their avatar.
     * @returns {object} An object with an array of comments and an object mapping names to avatar URLs.
     */
    function scrapeCommentsAndAvatars(commentsDiv, postAuthorName) {
        const avatars = {}; // Stores avatar URLs: { "Name": "url", ... }

        if (!commentsDiv) {
            return { comments: [], avatars };
        }

        const commentArticles = commentsDiv.querySelectorAll('div[role="article"]');

        // Try to get the post author's avatar if available
        const authorAvatarImage = document.querySelector("h2 a")?.closest(".x1cy8zhl")?.querySelector("image");
        if (authorAvatarImage && postAuthorName !== "AUTHOR_NOT_FOUND") {
            avatars[postAuthorName] = authorAvatarImage.getAttribute("xlink:href");
        }

        const rawComments = Array.from(commentArticles).map(commentEl => {
            // Determine comment depth based on parent element hierarchy
            let depth = 0;
            let currentParent = commentEl;
            while (currentParent && currentParent !== commentsDiv) {
                depth++;
                currentParent = currentParent.parentElement;
            }

            const ariaLabel = commentEl.getAttribute("aria-label") || "";
            // Regex to extract author name from aria-label (e.g., "Comment by John Doe 5 hours ago")
            const authorMatch = ariaLabel.match(/by (.*?)(?: to .*'s comment| \d+)/);
            const authorName = authorMatch ? authorMatch[1].trim() : null;

            // Comment message is typically in a div with dir="auto"
            const messageEl = commentEl.querySelector('div[dir="auto"]');
            const message = (authorName && messageEl) ? messageEl.innerText.trim() : null;

            // Find the avatar image within the comment article
            const avatarImage = commentEl.querySelector("image")?.getAttribute("xlink:href");

            if (message) {
                // If an avatar is found and not already stored, add it
                if (avatarImage && !avatars[authorName]) {
                    avatars[authorName] = avatarImage;
                }
                return {
                    commentObject: { name: authorName, message: message },
                    depth: depth
                };
            }
            return null; // Filter out comments that couldn't be parsed
        }).filter(Boolean); // Remove null entries

        if (rawComments.length === 0) {
            // Provide a fallback avatar if no comments or avatars are found
            avatars.fallback = "https://placehold.co/32x32/FFFFFF/000000?text=A";
            return { comments: [], avatars };
        }

        // Build a nested comment structure for replies
        const nestedComments = [];
        const commentStack = []; // Used to track parent comments for nesting

        rawComments.forEach(item => {
            const { commentObject, depth } = item;

            // Pop from stack if current comment is at a shallower or equal depth
            while (commentStack.length > 0 && depth <= commentStack[commentStack.length - 1].depth) {
                commentStack.pop();
            }

            if (commentStack.length > 0) {
                // If there's a parent on the stack, add as a reply
                const parentComment = commentStack[commentStack.length - 1].commentObject;
                if (!parentComment.replies) {
                    parentComment.replies = [];
                }
                parentComment.replies.push(commentObject);
            } else {
                // Otherwise, it's a top-level comment
                nestedComments.push(commentObject);
            }
            commentStack.push({ commentObject, depth });
        });

        // Clean up empty 'replies' arrays if no actual replies were found for a comment
        function removeEmptyReplies(comments) {
            comments.forEach(comment => {
                if (comment.replies && comment.replies.length > 0) {
                    removeEmptyReplies(comment.replies);
                } else {
                    delete comment.replies; // Remove the property if empty
                }
            });
        }
        removeEmptyReplies(nestedComments);

        avatars.fallback = "https://placehold.co/32x32/FFFFFF/000000?text=A"; // Ensure fallback is always present
        return { comments: nestedComments, avatars };
    }

    /**
     * Finalizes the scraped data and copies it to the clipboard as a JSON string.
     * @param {object} data - The object containing all scraped data.
     */
    function finalizeAndCopy(data) {
        const jsonString = JSON.stringify(data, null, 2); // Pretty print JSON

        // Use document.execCommand('copy') for better compatibility in iframes/bookmarklets
        const textarea = document.createElement('textarea');
        textarea.value = jsonString;
        textarea.style.position = 'fixed'; // Avoid scrolling to bottom
        textarea.style.opacity = '0'; // Make invisible
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert("Facebook post data copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy data to clipboard:", err);
            alert("Failed to copy data. See the browser console for details.");
        } finally {
            document.body.removeChild(textarea);
        }
    }

    /**
     * Main function to run the scraper.
     * Orchestrates finding containers, scraping data, and copying to clipboard.
     */
    function runScraper() {
        try {
            console.log("--- Starting Facebook Page Scraper v7.2 ---");

            const coreContainers = findCoreContainers();
            if (!coreContainers) {
                alert("Scraper could not orient itself on the page. Core containers not found. Check console.");
                return;
            }

            const { headerDiv, statsDiv, commentsDiv, datePermalink } = coreContainers;

            const { postAuthor, postLocation } = scrapePostAuthorAndMeta(headerDiv, datePermalink);
            const postDate = scrapePostDate(datePermalink);
            const { likes, totalComments } = scrapeEngagement(statsDiv);
            const { comments, avatars } = scrapeCommentsAndAvatars(commentsDiv, postAuthor);
            const mainPhotoUrl = scrapeMainPhoto(); // This now handles visibility check internally

            // Assemble all scraped data into a single object
            const scrapedData = {
                mainPhotoUrl: mainPhotoUrl,
                postAuthor: postAuthor,
                postDate: postDate,
                postLocation: postLocation,
                likes: likes,
                totalComments: totalComments,
                avatars: avatars,
                comments: comments
            };

            finalizeAndCopy(scrapedData);

        } catch (error) {
            console.error("The Facebook scraper bookmarklet failed to run:", error);
            alert("The scraper could not run successfully. Check the console for errors. The page structure may have changed.");
        }
    }

    // Execute the main scraper function when the bookmarklet is run
    runScraper();
    runScraper();
})();
