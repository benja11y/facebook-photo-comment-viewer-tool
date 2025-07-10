/**
 * @file script.js
 * @description Handles all the interactive logic for the Facebook photo page, including nested comments.
 */

// --- STATE --- //
let postData = {};
let flatCommentList = []; // A flattened list of all comments and replies
let currentCommentIndex = 0;

// --- DOM REFERENCES --- //
const mainPhoto = document.getElementById('main-photo');
const authorAvatar = document.getElementById('author-avatar');
const authorName = document.getElementById('author-name');
const postMeta = document.getElementById('post-meta');
const likeDetails = document.getElementById('like-details');
const totalCommentsText = document.getElementById('total-comments-text');
const userAvatar = document.getElementById('user-avatar');
const commentsContainer = document.getElementById('comments-container');
const commentCounterSpan = document.getElementById('comment-counter');
const imageSection = document.getElementById('image-section');
const overlayCommentsContainer = document.getElementById('overlay-comments-container');

// --- FUNCTIONS --- //

/**
 * Loads post data from localStorage or fetches it from the JSON file.
 * @param {function} callback - A callback function to handle the loaded data.
 */
function loadData(callback) {
  const localJson = localStorage.getItem('fb_photo_comment_json');
  if (localJson) {
    try {
      const data = JSON.parse(localJson);
      callback(data);
      return;
    } catch (e) {
      // fallback to fetch
    }
  }
  fetch('data.json')
    .then(response => response.json())
    .then(callback);
}

/**
 * Recursively flattens the nested comment structure into a single array.
 * @param {Array} comments - The array of comments to process.
 * @param {number} level - The current indentation level.
 * @returns {Array} A flat array of comment objects with a 'level' property.
 */
function flattenComments(comments, level = 0) {
    let flatList = [];
    comments.forEach(comment => {
        flatList.push({ ...comment, level });
        if (comment.replies && comment.replies.length > 0) {
            flatList = flatList.concat(flattenComments(comment.replies, level + 1));
        }
    });
    return flatList;
}

/**
 * Populates the main post details into the DOM.
 * @param {object} data - The fetched post data.
 */
function populatePostDetails(data) {
    mainPhoto.src = data.mainPhotoUrl;
    mainPhoto.onerror = () => { mainPhoto.src = '[https://placehold.co/1200x800/000000/FFFFFF?text=Image+Not+Found](https://placehold.co/1200x800/000000/FFFFFF?text=Image+Not+Found)'; };
    
    authorAvatar.src = data.avatars[data.postAuthor];
    authorAvatar.onerror = () => { authorAvatar.src = data.avatars.fallback; };

    authorName.textContent = data.postAuthor;
    postMeta.prepend(`${data.postDate} · ${data.postLocation}`);
    
    likeDetails.textContent = `${data.likes.firstLiker} and ${data.likes.otherCount} others`;
    totalCommentsText.textContent = `${data.totalComments} Comments`;

    const firstCommenter = data.comments[0]?.name || data.postAuthor;
    userAvatar.src = data.avatars[firstCommenter] || data.avatars.fallback;
    userAvatar.onerror = () => { userAvatar.src = data.avatars.fallback; };
}

/**
 * Creates an HTML element for a single comment.
 * @param {object} commentData - The comment data object {name, message, level}.
 * @returns {HTMLElement} The created article element for the comment.
 */
function createCommentElement(commentData) {
    const article = document.createElement('article');
    article.className = 'comment-article';
    if (commentData.level > 0) {
        article.classList.add('comment-reply');
        // Apply indentation based on the level
        article.style.marginLeft = `${commentData.level * 2.75}rem`;
    }

    const avatarSrc = postData.avatars[commentData.name] || postData.avatars.fallback;

    article.innerHTML = `
        <img src="${avatarSrc}" alt="${commentData.name}'s avatar" class="avatar-small" onerror="this.onerror=null;this.src='${postData.avatars.fallback}';">
        <div class="comment-content">
            <p class="comment-author">${commentData.name}</p>
            <p class="comment-message"></p>
        </div>
    `;

    const messageP = article.querySelector('.comment-message');
    if (commentData.message.startsWith('http')) {
        const link = document.createElement('a');
        link.href = commentData.message;
        link.textContent = commentData.message;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        messageP.appendChild(link);
    } else {
        messageP.textContent = commentData.message;
    }
    
    return article;
}

/**
 * Creates an HTML element for an overlay comment bubble.
 * @param {object} commentData - The comment data object.
 * @returns {HTMLElement} The created article element for the overlay.
 */
function createOverlayCommentElement(commentData) {
    const article = document.createElement('article');
    article.className = 'overlay-comment-bubble';
    const avatarSrc = postData.avatars[commentData.name] || postData.avatars.fallback;

    article.innerHTML = `
        <img src="${avatarSrc}" alt="${commentData.name}'s avatar" class="avatar-small" onerror="this.onerror=null;this.src='${postData.avatars.fallback}';">
        <div class="comment-content">
            <p class="comment-author">${commentData.name}</p>
            <p class="comment-message">${commentData.message}</p>
        </div>
    `;
    return article;
}

/**
 * Updates the comment counter display on the page.
 */
function updateCommentCounter() {
    commentCounterSpan.textContent = currentCommentIndex;
}

/**
 * Updates the overlay comments based on the current state.
 */
function updateOverlayComments() {
    overlayCommentsContainer.innerHTML = ''; // Clear existing overlays
    if (currentCommentIndex === 0) return;
    const lastCommentData = flatCommentList[currentCommentIndex - 1];
    const lastCommentBubble = createOverlayCommentElement(lastCommentData);
    overlayCommentsContainer.appendChild(lastCommentBubble);
}

/**
 * Adds the next comment to the sidebar and updates the overlay.
 * @param {boolean} shouldScroll - If true, the new comment will be scrolled into view.
 */
function handleNextComment(shouldScroll = false) {
    if (currentCommentIndex < flatCommentList.length) {
        const commentData = flatCommentList[currentCommentIndex];
        const commentElement = createCommentElement(commentData);
        commentsContainer.appendChild(commentElement);
        
        if (shouldScroll) {
            commentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }

        currentCommentIndex++;
        updateCommentCounter();
        updateOverlayComments();
    }
}

/**
 * Removes the last comment from the sidebar and updates the overlay.
 */
function handlePreviousComment() {
    if (currentCommentIndex > 0) {
        const lastComment = commentsContainer.lastElementChild;
        if (lastComment) {
            commentsContainer.removeChild(lastComment);
        }
        currentCommentIndex--;
        updateCommentCounter();
        updateOverlayComments();
    }
}

/**
 * Sets up all the necessary event listeners for the page.
 */
function setupEventListeners() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') handleNextComment(true);
        else if (event.key === 'ArrowLeft') handlePreviousComment();
    });

    imageSection.addEventListener('click', (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const middleOfElement = rect.left + rect.width / 2;
        if (event.clientX > middleOfElement) handleNextComment(false);
        else handlePreviousComment();
    });
}

/**
 * Initializes the application.
 */
async function initializeApp() {
    loadData((data) => {
        postData = data;
        flatCommentList = flattenComments(postData.comments);
        populatePostDetails(postData);
        setupEventListeners();
    });
}

// --- INITIALIZATION --- //
document.addEventListener('DOMContentLoaded', initializeApp);
